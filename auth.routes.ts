// PATH: auth.routes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  requestOtpForPhone,
  verifyOtpAndAuthenticate,
  findUserInSupabaseByEmail,
  generateAuthToken,
  supabaseAdmin,
} from './auth.service';
import { verifyAdmin, AdminRequest } from './middleware/verifyAdmin';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';
import { formatPortuguesePhone } from './whatsapp.service';

/**
 * Normaliza números portugueses para o formato internacional 351XXXXXXXXX.
 * Aceita números nacionais de 9 algarismos ou internacionais com indicativo 351.
 */
export function normalizePortuguesePhone(rawPhone: string): string | null {
  return formatPortuguesePhone(rawPhone) || null;
}

export const authRouter = Router();

/**
 * Validação algorítmica de NIF Português
 */
export function validatePortugueseNIF(nifRaw: string): { isValid: boolean; message?: string } {
  const nif = String(nifRaw).trim();

  if (!/^\d{9}$/.test(nif)) {
    return { isValid: false, message: 'O NIF deve conter exatamente 9 algarismos numéricos.' };
  }

  const firstDigit = nif.charAt(0);
  const validFirstDigits = ['1', '2', '3', '5', '6', '8', '9'];
  if (!validFirstDigits.includes(firstDigit)) {
    return { isValid: false, message: 'Prefixo do NIF inválido segundo a Autoridade Tributária.' };
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif.charAt(i), 10) * (9 - i);
  }

  const remainder = sum % 11;
  const expectedCheckDigit = remainder < 2 ? 0 : 11 - remainder;
  const actualCheckDigit = parseInt(nif.charAt(8), 10);

  if (expectedCheckDigit !== actualCheckDigit) {
    return { isValid: false, message: 'Dígito de controlo do NIF incorreto.' };
  }

  return { isValid: true };
}

/* =========================================================================
   1. ENDPOINT: PEDIDO DE OTP WHATSAPP (/auth/request-otp)
   Especificação estrita: Normalização PT (+351), Supabase Service Role,
   Evolution API na instância diamante-os e logs detalhados a cada passo.
   ========================================================================= */

export async function handleRequestOtp(req: Request, res: Response): Promise<void> {
  try {
    const rawPhone = req.body?.phone || req.body?.telemovel || req.body?.number;
    if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
      res.status(400).json({ success: false, message: 'Número de telemóvel é obrigatório.' });
      return;
    }

    const normalizedPhone = normalizePortuguesePhone(rawPhone);
    if (!normalizedPhone) {
      res.status(400).json({ success: false, message: 'Número de telemóvel português inválido.' });
      return;
    }

    const result = await requestOtpForPhone(normalizedPhone);
    if (!result.success) {
      res.status(result.statusCode || 400).json({ success: false, message: result.message });
      return;
    }

    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error('[OTP] Falha ao solicitar código.');
    res.status(500).json({ success: false, message: 'Erro interno ao solicitar autenticação.' });
  }
}

authRouter.post('/request-otp', handleRequestOtp);
authRouter.post('/send-otp', handleRequestOtp);

/* =========================================================================
   2. ENDPOINT: VALIDAÇÃO DE OTP WHATSAPP (/auth/verify-otp)
   REGRA: Role e permissões extraídas diretamente da base de dados Supabase
   ========================================================================= */
authRouter.get('/session', verifyAuth, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({ success: true, user: req.authenticatedUser });
});

authRouter.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      res.status(400).json({
        success: false,
        message: 'Número de telemóvel e código OTP são obrigatórios.',
      });
      return;
    }

    const result = await verifyOtpAndAuthenticate(phone, code);

    if (!result.success || !result.user || !result.token) {
      res.status(result.statusCode || 401).json({
        success: false,
        message: result.message || 'Código incorreto ou expirado.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      token: result.token,
      role: result.role,
      user: result.user,
    });
  } catch (error: unknown) {
    console.error('[Auth Verify OTP] Falha interna.');
    res.status(500).json({
      success: false,
      message: 'Falha interna ao validar o código OTP.',
    });
  }
});

/* =========================================================================
   3. ENDPOINT: LOGIN EMAIL/PASSWORD (/auth/login)
   ========================================================================= */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Por favor introduza o email e a palavra-passe.',
      });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 1. Tentar autenticação via Supabase Auth
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!authError && authData?.user) {
        const dbUser = await findUserInSupabaseByEmail(normalizedEmail);
        if (!dbUser || dbUser.id !== authData.user.id || dbUser.ativo !== true) {
          res.status(403).json({
            success: false,
            message: 'A conta Auth não tem um perfil de funcionário ativo e correspondente.',
          });
          return;
        }

        const token = generateAuthToken(dbUser);
        res.status(200).json({
          success: true,
          token,
          role: dbUser.role,
          user: dbUser,
            });
        return;
      }
    } catch {
      // Falha no Supabase Auth: falhar fechado, sem autenticação alternativa
    }

    // Não emitir sessão sem validação de password pelo Supabase Auth.
    res.status(401).json({
      success: false,
      message: 'Credenciais inválidas ou conta inativa no sistema.',
    });
    return;
  } catch (error: unknown) {
    console.error('[Auth Login] Falha interna.');
    res.status(500).json({
      success: false,
      message: 'Erro interno ao validar autenticação.',
    });
  }
});

/* =========================================================================
   4. ENDPOINT: REGISTO (/auth/register)
   ========================================================================= */
authRouter.post('/register', (_req: Request, res: Response): void => {
  res.status(403).json({
    success: false,
    message: 'O registo público está desativado. A criação de contas é feita exclusivamente por um administrador autorizado.',
  });
});

/* =========================================================================
   4. MÓDULOS DE GESTÃO ADMINISTRATIVA
   Endpoints protegidos por verifyAdmin com validação da identidade ativa na BD
   ========================================================================= */

// Nominatim Geocoding com throttle de 1.1s entre pedidos
let lastNominatimRequestTime = 0;

export async function geocodePortugueseAddress(morada: string): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const trimmed = String(morada || '').trim();
    if (!trimmed) return { latitude: null, longitude: null };

    const now = Date.now();
    const diff = now - lastNominatimRequestTime;
    if (diff < 1100) {
      await new Promise((resolve) => setTimeout(resolve, 1100 - diff));
    }
    lastNominatimRequestTime = Date.now();

    const query = `${trimmed}, Portugal`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DiamanteOS/2.0 (contact@diamante.pt)',
        'Accept-Language': 'pt-PT,pt;q=0.9',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          return { latitude: lat, longitude: lon };
        }
      }
    }
  } catch (err: any) {
    console.warn('[Geocoding Nominatim] Falha na consulta de endereço.');
  }

  return { latitude: null, longitude: null };
}

// A persistência das configurações financeiras ainda não está implementada.
// Não devolver valores de demonstração nem aceitar gravações apenas em memória.
function handleGetMargensConfig(_req: Request, res: Response): void {
  res.status(503).json({
    success: false,
    message: 'A persistência das configurações de negócio ainda não está disponível.',
  });
}

function handleUpdateMargensConfig(_req: AdminRequest, res: Response): void {
  res.status(503).json({
    success: false,
    message: 'A persistência das configurações de negócio ainda não está disponível. Nenhuma alteração foi guardada.',
  });
}

// Registo de Rotas Administrativas em authRouter (suporte com e sem prefixo /admin)
authRouter.post('/admin/lojas', verifyAdmin, handleCreateLoja);
authRouter.post('/lojas', verifyAdmin, handleCreateLoja);
authRouter.put('/admin/lojas/:id', verifyAdmin, handleUpdateLoja);
authRouter.put('/lojas/:id', verifyAdmin, handleUpdateLoja);
authRouter.get('/admin/lojas', verifyAdmin, handleGetLojas);
authRouter.get('/lojas', verifyAdmin, handleGetLojas);

authRouter.post('/admin/funcionarios', verifyAdmin, handleCreateFuncionario);
authRouter.post('/funcionarios', verifyAdmin, handleCreateFuncionario);
authRouter.put('/admin/funcionarios/:id', verifyAdmin, handleUpdateFuncionario);
authRouter.put('/funcionarios/:id', verifyAdmin, handleUpdateFuncionario);
authRouter.get('/admin/funcionarios', verifyAdmin, handleGetFuncionarios);
authRouter.get('/funcionarios', verifyAdmin, handleGetFuncionarios);

authRouter.get('/admin/config/margens', verifyAdmin, handleGetMargensConfig);
authRouter.get('/config/margens', verifyAdmin, handleGetMargensConfig);
authRouter.put('/admin/config/margens', verifyAdmin, handleUpdateMargensConfig);
authRouter.put('/config/margens', verifyAdmin, handleUpdateMargensConfig);

export default authRouter;

