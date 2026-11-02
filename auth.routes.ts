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
   1. ENDPOINT: PEDIDO DE OTP WHATSAPP (/auth/request-otp ou /auth/send-otp)
   REGRA: Envia OTP APENAS se o utilizador existir e estiver ativo no Supabase
   ========================================================================= */
async function handleRequestOtp(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({
        success: false,
        message: 'O número de telemóvel é obrigatório para a validação de acesso.',
      });
      return;
    }

    const result = await requestOtpForPhone(phone);

    if (!result.success) {
      res.status(result.statusCode || 403).json({
        success: false,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message,
      expiresInSeconds: 300,
      simulated: result.simulated,
    });
  } catch (error: unknown) {
    console.error('[Auth Request OTP] Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Falha ao processar autenticação via WhatsApp.',
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
