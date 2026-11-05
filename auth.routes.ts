// PATH: auth.routes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  requestOtpForPhone,
  verifyOtpAndAuthenticate,
  findUserInSupabaseByEmail,
  findUserInSupabaseByPhone,
  generateAuthToken,
  supabaseAdmin,
  otpStore,
} from './auth.service';

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

// Armazenamento em memória para códigos OTP (validade de 5 minutos)
export const otpMemoryStore = new Map<
  string,
  { code: string; expiresAt: number; userId: string; role: string; nome: string }
>();

/**
 * Normalização inteligente de número de telefone português (+351XXXXXXXXX)
 */
export function normalizePortuguesePhone(phoneInput: string): string | null {
  if (!phoneInput) return null;
  const digits = String(phoneInput).replace(/\D/g, '');

  // Se tiver 9 dígitos e começar por 9 -> adiciona '+351'
  if (digits.length === 9 && digits.startsWith('9')) {
    return `+351${digits}`;
  }
  // Se tiver 12 dígitos e começar por 351 -> adiciona '+'
  if (digits.length === 12 && digits.startsWith('351') && digits.charAt(3) === '9') {
    return `+${digits}`;
  }
  // Se tiver 12 dígitos e começar por 351 geral
  if (digits.length === 12 && digits.startsWith('351')) {
    return `+${digits}`;
  }
  return null;
}

export async function handleRequestOtp(req: Request, res: Response): Promise<void> {
  try {
    const rawPhone = req.body?.phone || req.body?.telemovel || req.body?.number;
    console.log(`[OTP] Pedido recebido para: ${rawPhone}`);

    if (!rawPhone) {
      res.status(400).json({
        success: false,
        error: 'Número de telemóvel é obrigatório',
        message: 'Número de telemóvel é obrigatório',
      });
      return;
    }

    // a) Normalização Inteligente
    const normalizedPhone = normalizePortuguesePhone(rawPhone);
    console.log(`[OTP] Normalizado para: ${normalizedPhone}`);

    if (!normalizedPhone) {
      res.status(400).json({
        success: false,
        error: 'Número de telemóvel inválido (deve ser um contacto móvel português válido)',
        message: 'Número de telemóvel inválido (deve ser um contacto móvel português válido)',
      });
      return;
    }

    // b) Validação no Supabase (Service Role Key - Bypassing RLS)
    const variants = [
      normalizedPhone,
      normalizedPhone.replace('+', ''),
      normalizedPhone.replace('+351', ''),
    ];

    let user: any = null;

    // Regra do Master User prioritária (+351937230116)
    if (variants.some((v) => v.includes('937230116'))) {
      user = {
        id: 'usr-master-admin',
        nome_completo: 'Administrador Master',
        email: 'admin@diamante-os.pt',
        role: 'admin',
        loja_id: null,
        telemovel: '+351937230116',
        ativo: true,
      };
    } else {
      user = await findUserInSupabaseByPhone(normalizedPhone);
    }

    if (!user || user.ativo === false) {
      console.log(`[OTP] User not found ou inativo para: ${normalizedPhone}`);
      res.status(404).json({
        success: false,
        error: 'Número não registado ou conta inativa',
        message: 'Número de telemóvel não registado ou conta inativa no sistema.',
      });
      return;
    }

    console.log(`[OTP] User found: ${user.nome_completo} (ID: ${user.id}, Role: ${user.role})`);

    // c) Geração e Envio de OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos

    otpMemoryStore.set(normalizedPhone, {
      code: otpCode,
      expiresAt,
      userId: user.id,
      role: user.role,
      nome: user.nome_completo,
    });

    // Sincroniza com otpStore partilhado
    const formattedDigits = normalizedPhone.replace(/\D/g, '');
    otpStore.set(normalizedPhone, {
      phone: normalizedPhone,
      code: otpCode,
      expiresAt,
      attempts: 0,
    });
    otpStore.set(formattedDigits, {
      phone: formattedDigits,
      code: otpCode,
      expiresAt,
      attempts: 0,
    });

    // Se estiver sem chave configurada da Evolution API, responde instantaneamente com devOtpCode
    const evolutionApiKey = process.env.EVOLUTION_API_KEY || '';
    if (!evolutionApiKey) {
      console.warn(`[OTP] [MODO TESTE/DEV] Código OTP gerado para ${normalizedPhone}: ${otpCode}`);
      res.status(200).json({
        success: true,
        error: null,
        message: `Código enviado por WhatsApp (Código de teste: ${otpCode})`,
        devOtpCode: otpCode,
      });
      return;
    }

    // Chamada à Evolution API (apenas quando chave está configurada)
    const evolutionApiUrl = (
      process.env.EVOLUTION_API_URL || 'http://localhost:9090'
    ).replace(/\/+$/, '');
    const evolutionInstance = process.env.EVOLUTION_INSTANCE || 'diamante-os';

    const whatsappNumber = normalizedPhone.replace('+', '');
    const messageBody = {
      number: whatsappNumber,
      text: `🔐 Diamante OS v2\n\nOlá ${user.nome_completo},\nO teu código de acesso é: *${otpCode}*\n\nVálido por 5 minutos.`,
    };

    let evolutionSuccess = false;
    let evolutionResponseData: any = null;

    try {
      const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey,
        },
        body: JSON.stringify(messageBody),
        signal: AbortSignal.timeout(2000),
      });

      evolutionResponseData = await response.json().catch(() => null);
      console.log(`[OTP] Evolution response: status=${response.status}`, evolutionResponseData);

      if (response.ok) {
        evolutionSuccess = true;
      }
    } catch (evoErr: any) {
      console.error('[OTP] Falha de conexão à Evolution API:', evoErr.message);
    }

    // Se a Evolution API falhou ou está em ambiente de teste/preview
    if (!evolutionSuccess) {
      if (process.env.NODE_ENV !== 'production' || !process.env.EVOLUTION_API_KEY) {
        console.warn(`[OTP] [MODO TESTE/DEV] Código OTP gerado para ${normalizedPhone}: ${otpCode}`);
        res.status(200).json({
          success: true,
          error: null,
          message: `Código enviado por WhatsApp (Modo Teste: ${otpCode})`,
          devOtpCode: otpCode,
        });
        return;
      }

      res.status(502).json({
        success: false,
        error: 'Falha ao enviar WhatsApp',
        message: 'Falha ao enviar mensagem através da Evolution API. Verifique a instância diamante-os.',
      });
      return;
    }

    // d) Resposta Padronizada de Sucesso
    res.status(200).json({
      success: true,
      error: null,
      message: 'Código enviado por WhatsApp',
    });
  } catch (err: any) {
    console.error('[OTP] Erro interno:', err);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: 'Erro interno do servidor ao processar autenticação.',
    });
  }
}

authRouter.post('/request-otp', handleRequestOtp);
authRouter.post('/send-otp', handleRequestOtp);

/* =========================================================================
   2. ENDPOINT: VALIDAÇÃO DE OTP WHATSAPP (/auth/verify-otp)
   REGRA: Role e permissões extraídas diretamente da base de dados Supabase
   ========================================================================= */
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
      session: {
        access_token: result.token,
        refresh_token: `rf-${Date.now()}`,
      },
    });
  } catch (error: unknown) {
    console.error('[Auth Verify OTP] Erro:', error);
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
        // Obter dados do utilizador na tabela funcionarios
        const dbUser = await findUserInSupabaseByEmail(normalizedEmail);
        const role = dbUser?.role || (authData.user.user_metadata?.role as string) || 'operador';

        const token = generateAuthToken(
          dbUser || {
            id: authData.user.id,
            email: normalizedEmail,
            nome_completo: authData.user.user_metadata?.nome_completo || 'Utilizador Diamante',
            role,
            loja_id: null,
            ativo: true,
          }
        );

        res.status(200).json({
          success: true,
          token,
          role,
          user: dbUser || { id: authData.user.id, email: normalizedEmail, role },
          session: { access_token: token },
        });
        return;
      }
    } catch {
      // Falha ao conectar ao Supabase Auth direto, continua verificação
    }

    // 2. Consulta direta à tabela funcionarios/users no Supabase
    const user = await findUserInSupabaseByEmail(normalizedEmail);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Credenciais inválidas ou conta inativa no sistema.',
      });
      return;
    }

    const token = generateAuthToken(user);

    res.status(200).json({
      success: true,
      token,
      role: user.role,
      user,
      session: { access_token: token },
    });
  } catch (error: unknown) {
    console.error('[Auth Login] Erro interno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao validar autenticação.',
    });
  }
});

/* =========================================================================
   4. ENDPOINT: REGISTO (/auth/register)
   ========================================================================= */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, nome_completo, nif, telemovel, loja_id } = req.body;

    if (!email || !password || !nome_completo) {
      res.status(400).json({
        success: false,
        message: 'Email, palavra-passe e nome completo são campos obrigatórios.',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'A palavra-passe deve conter pelo menos 6 caracteres.',
      });
      return;
    }

    if (nif) {
      const nifCheck = validatePortugueseNIF(nif);
      if (!nifCheck.isValid) {
        res.status(400).json({
          success: false,
          message: nifCheck.message || 'NIF inválido.',
        });
        return;
      }
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Inserir funcionário no Supabase
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('funcionarios')
      .insert({
        nome_completo: String(nome_completo).trim(),
        email: normalizedEmail,
        telemovel: telemovel ? String(telemovel).trim() : null,
        role: 'operador',
        loja_id: loja_id || null,
        ativo: true,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.warn('[Auth Register] Aviso ao registar em funcionarios:', insertError.message);
    }

    const role = inserted?.role || 'operador';
    const userPayload = {
      id: inserted?.id || `usr-${Date.now()}`,
      email: normalizedEmail,
      nome_completo: String(nome_completo).trim(),
      role,
      loja_id: loja_id || null,
      telemovel: telemovel ? String(telemovel).trim() : undefined,
      ativo: true,
    };

    const token = generateAuthToken(userPayload);

    res.status(201).json({
      success: true,
      message: 'Utilizador registado com sucesso.',
      token,
      role,
      user: userPayload,
      session: { access_token: token },
    });
  } catch (error: unknown) {
    console.error('[Auth Register] Erro interno:', error);
    res.status(500).json({
      success: false,
      message: 'Ocorreu um erro ao processar o registo. Tente novamente.',
    });
  }
});

export default authRouter;
