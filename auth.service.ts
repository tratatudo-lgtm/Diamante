// PATH: auth.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt, createHmac } from 'crypto';
import { sendWhatsAppOtp, formatPortuguesePhone } from './whatsapp.service';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('GERAR_SEGREDO_ALEATORIO')) {
    throw new Error('JWT_SECRET tem de ser um segredo real com pelo menos 32 caracteres.');
  }
  return secret;
})();

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl || supabaseUrl.includes('your-project.supabase.co')) {
  throw new Error('SUPABASE_URL tem de conter o endereço real do projeto configurado no servidor.');
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey || supabaseKey === 'SUPABASE_SERVICE_ROLE_SECRET' || supabaseKey.toLowerCase().includes('placeholder')) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY tem de conter uma chave real do servidor; nunca usar anon key como cliente admin.');
}

// Cliente Supabase com privilégios de administração (Service Role ou Anon Key)
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface AuthenticatedUser {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
  loja_id: string | null;
  telemovel?: string;
  loja_nome?: string | null;
  codigo_loja?: string | null;
  ativo: boolean;
}

const OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET;
if (!OTP_HMAC_SECRET || OTP_HMAC_SECRET.length < 32) {
  throw new Error('OTP_HMAC_SECRET tem de ser um segredo real com pelo menos 32 caracteres.');
}

function otpDigest(value: string): string {
  return createHmac('sha256', OTP_HMAC_SECRET!).update(value).digest('hex');
}

/**
 * Gera variantes normalizadas para pesquisa de um número de telemóvel português.
 */
function getPhoneVariants(rawPhone: string): string[] {
  const canonical = formatPortuguesePhone(rawPhone);

  if (!canonical) return [];

  const national = canonical.slice(3);

  return Array.from(new Set([
    canonical,
    `+${canonical}`,
    national,
  ]));
}

/**
 * REGRA DE OURO: Consulta estrita à base de dados Supabase (tabela funcionarios e users).
 * ZERO HARDCODE: Nenhum número ou email é fixado em código.
 */
export async function findUserInSupabaseByPhone(phone: string): Promise<AuthenticatedUser | null> {
  const variants = getPhoneVariants(phone);
  if (variants.length === 0) return null;

  try {
    // 1. Tentar consultar na tabela 'funcionarios' com as variantes do telemóvel
    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo, lojas(nome, codigo_loja)')
      .in('telemovel', variants)
      .limit(2);

    if (!error && Array.isArray(data) && data.length === 1) {
      const matchedUser = data[0];
      const userId =
        typeof matchedUser.id === 'string' ? matchedUser.id.trim() : '';
      const fullName =
        typeof matchedUser.nome_completo === 'string'
          ? matchedUser.nome_completo.trim()
          : '';
      const userRole =
        typeof matchedUser.role === 'string'
          ? matchedUser.role.trim().toLowerCase()
          : '';

      // A autenticação OTP só pode prosseguir com um registo ativo
      // e com os campos essenciais efetivamente presentes na base de dados.
      if (
        matchedUser.ativo !== true ||
        !userId ||
        !fullName ||
        !userRole
      ) {
        return null;
      }

      const store = Array.isArray(matchedUser.lojas) ? matchedUser.lojas[0] : matchedUser.lojas;
      return {
        id: userId,
        nome_completo: fullName,
        email: typeof matchedUser.email === 'string' ? matchedUser.email : '',
        role: userRole,
        loja_id: matchedUser.loja_id ?? null,
        loja_nome: typeof store?.nome === 'string' ? store.nome : null,
        codigo_loja: typeof store?.codigo_loja === 'string' ? store.codigo_loja : null,
        telemovel:
          typeof matchedUser.telemovel === 'string' &&
          matchedUser.telemovel.trim()
            ? matchedUser.telemovel
            : phone,
        ativo: true,
      };
    }
  } catch (err: any) {
    console.warn('[Auth Service] Falha na consulta Supabase por telemóvel.');
  }

  return null;
}

/**
 * Consulta estrita à base de dados Supabase por Email
 */
export async function findUserInSupabaseByEmail(email: string): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo, lojas(nome, codigo_loja)')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!error && data) {
      const userId =
        typeof data.id === 'string' ? data.id.trim() : '';
      const fullName =
        typeof data.nome_completo === 'string'
          ? data.nome_completo.trim()
          : '';
      const userEmail =
        typeof data.email === 'string' ? data.email.trim() : '';
      const userRole =
        typeof data.role === 'string'
          ? data.role.trim().toLowerCase()
          : '';

      if (
        data.ativo !== true ||
        !userId ||
        !fullName ||
        !userEmail ||
        !userRole
      ) {
        return null;
      }

      const store = Array.isArray(data.lojas) ? data.lojas[0] : data.lojas;
      return {
        id: userId,
        nome_completo: fullName,
        email: userEmail,
        role: userRole,
        loja_id: data.loja_id ?? null,
        loja_nome: typeof store?.nome === 'string' ? store.nome : null,
        codigo_loja: typeof store?.codigo_loja === 'string' ? store.codigo_loja : null,
        telemovel:
          typeof data.telemovel === 'string' ? data.telemovel : undefined,
        ativo: true,
      };
    }


  } catch (err) {
    console.error('[Auth Service] Falha na consulta Supabase por email.');
  }

  return null;
}

/**
 * Geração de Token JWT com a role extraída diretamente do Supabase
 */
export function generateAuthToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      nome_completo: user.nome_completo,
      role: user.role,
      loja_id: user.loja_id,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Solicitação de OTP WhatsApp:
 * REGRA CRÍTICA: Envia OTP via Evolution API APENAS após confirmar que o número existe no Supabase!
 */
export async function requestOtpForPhone(rawPhone: string): Promise<{
  success: boolean;
  message: string;
  statusCode?: number;
  simulated?: boolean;
}> {
  const formatted = formatPortuguesePhone(rawPhone);
  if (!formatted) {
    return {
      success: false,
      message: 'Introduza um número de telemóvel válido.',
      statusCode: 400,
    };
  }

  // 1. Validate the registered, active employee before generating a challenge.
  // 1. Validação estrita contra a BD Supabase
  const user = await findUserInSupabaseByPhone(formatted);

  if (!user) {
    console.warn('[Auth Service] Pedido OTP recusado: número não registado ou conta inativa.');
    return {
      success: false,
      message: 'Número de telemóvel não autorizado ou conta inativa no sistema.',
      statusCode: 403,
    };
  }

  const otpCode = randomInt(100000, 1000000).toString();
  const phoneHash = otpDigest('phone:' + formatted);
  const codeHash = otpDigest('code:' + formatted + ':' + otpCode);
  const { data: challengeRows, error: challengeError } = await supabaseAdmin.rpc('create_whatsapp_otp_challenge', {
    p_phone_hash: phoneHash,
    p_employee_id: user.id,
    p_code_hash: codeHash,
    p_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  const challengeStatus = Array.isArray(challengeRows) ? challengeRows[0]?.status : null;
  if (challengeError || challengeStatus !== 'created') {
    return {
      success: false,
      message: challengeStatus === 'pending'
        ? 'Já existe um código ativo. Utilize o código recebido ou aguarde a sua expiração.'
        : challengeStatus === 'rate_limited'
          ? 'Demasiados pedidos de código. Tente novamente mais tarde.'
          : 'Não foi possível preparar a validação. Tente novamente mais tarde.',
      statusCode: challengeStatus === 'pending' || challengeStatus === 'rate_limited' ? 429 : 503,
    };
  }

  console.log('[Auth Service] Utilizador validado; a iniciar envio de OTP.');

  // 3. Envia código via Evolution API. Revoke only this exact challenge if delivery fails.
  let sendResult: Awaited<ReturnType<typeof sendWhatsAppOtp>>;
  try {
    sendResult = await sendWhatsAppOtp(formatted, otpCode);
  } catch {
    await supabaseAdmin.rpc('revoke_whatsapp_otp_challenge', {
      p_phone_hash: phoneHash,
      p_code_hash: codeHash,
    });
    return {
      success: false,
      message: 'Não foi possível confirmar o envio real do código por WhatsApp. Solicite um novo código mais tarde.',
      statusCode: 502,
    };
  }

  if (!sendResult.success || sendResult.simulated) {
    await supabaseAdmin.rpc('revoke_whatsapp_otp_challenge', {
      p_phone_hash: phoneHash,
      p_code_hash: codeHash,
    });
    return {
      success: false,
      message: 'Não foi possível confirmar o envio real do código por WhatsApp. Solicite um novo código mais tarde.',
      statusCode: 502,
    };
  }

  return {
    success: true,
    message: 'Código de verificação enviado por WhatsApp com sucesso.',
    simulated: sendResult.simulated || false,
  };
}

/**
 * Validação de OTP e Geração de Sessão com Role do Supabase
 */
export async function verifyOtpAndAuthenticate(
  rawPhone: string,
  inputCode: string
): Promise<{
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthenticatedUser;
  role?: string;
  statusCode?: number;
}> {
  const code = typeof inputCode === 'string' ? inputCode.trim() : '';
  if (typeof rawPhone !== 'string' || !/^\d{6}$/.test(code)) {
    return {
      success: false,
      message: 'Introduza um número de telemóvel válido e um código de 6 algarismos.',
      statusCode: 400,
    };
  }

  const formatted = formatPortuguesePhone(rawPhone);

  if (!formatted) {
    return {
      success: false,
      message: 'Introduza um número de telemóvel português válido.',
      statusCode: 400,
    };
  }

  const phoneHash = otpDigest('phone:' + formatted);
  const codeHash = otpDigest('code:' + formatted + ':' + code);
  const { data: consumedRows, error: consumeError } = await supabaseAdmin.rpc('consume_whatsapp_otp_challenge', {
    p_phone_hash: phoneHash,
    p_code_hash: codeHash,
  });
  if (consumeError) {
    return { success: false, message: 'Não foi possível validar o código neste momento.', statusCode: 503 };
  }
  const consumed = Array.isArray(consumedRows) ? consumedRows[0] : null;
  if (consumed?.status !== 'valid' || typeof consumed.employee_id !== 'string') {
    const messages: Record<string, string> = {
      expired: 'O código de verificação expirou após 5 minutos. Solicite um novo código.',
      locked: 'Demasiadas tentativas incorrectas. O código foi cancelado.',
      invalid: 'Código de verificação incorrecto.',
      not_found: 'Código de verificação inexistente ou já utilizado. Solicite um novo código.',
    };
    return {
      success: false,
      message: messages[consumed?.status] || 'Código de verificação inexistente ou expirado. Solicite um novo código.',
      statusCode: consumed?.status === 'locked' ? 429 : consumed?.status === 'invalid' ? 401 : 400,
    };
  }

  // Consulta novamente a base de dados Supabase para obter os privilégios reais
  const dbUser = await findUserInSupabaseByPhone(formatted);
  if (!dbUser || consumed.employee_id !== dbUser.id) {
    return {
      success: false,
      message: 'Acesso negado. Registo de utilizador inexistente ou inativo no Supabase.',
      statusCode: 403,
    };
  }

  // Gera token com a role real do Supabase
  const token = generateAuthToken(dbUser);

  return {
    success: true,
    token,
    user: dbUser,
    role: dbUser.role,
  };
}
