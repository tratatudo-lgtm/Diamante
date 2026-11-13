// PATH: auth.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { sendWhatsAppOtp, formatPortuguesePhone } from './whatsapp.service';
import { isOtpActive } from './otp-session';

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
  ativo: boolean;
}

interface StoredOtp {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
  userId?: string;
}

// Armazenamento em memória para códigos OTP ativos
export const otpStore = new Map<string, StoredOtp>();

const otpRequestLimits = new Map<string, { count: number; resetAt: number }>();

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
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo')
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

      return {
        id: userId,
        nome_completo: fullName,
        email: typeof matchedUser.email === 'string' ? matchedUser.email : '',
        role: userRole,
        loja_id: matchedUser.loja_id ?? null,
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
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo')
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

      return {
        id: userId,
        nome_completo: fullName,
        email: userEmail,
        role: userRole,
        loja_id: data.loja_id ?? null,
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

  const now = Date.now();
  const limit = otpRequestLimits.get(formatted);
  if (limit && now < limit.resetAt && limit.count >= 5) {
    return { success: false, message: 'Demasiados pedidos de código. Tente novamente mais tarde.', statusCode: 429 };
  }
  if (!limit || now >= limit.resetAt) {
    otpRequestLimits.set(formatted, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    limit.count += 1;
  }
  if (otpRequestLimits.size > 10000) {
    for (const [key, value] of otpRequestLimits) {
      if (now >= value.resetAt) otpRequestLimits.delete(key);
    }
  }

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

  // 2. Gera código de 6 dígitos
  const otpCode = randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos

  otpStore.set(formatted, {
    phone: formatted,
    code: otpCode,
    expiresAt,
    attempts: 0,
    userId: user.id,
  });

  console.log('[Auth Service] Utilizador validado; a iniciar envio de OTP.');

  // 3. Envia código via Evolution API
  const sendResult = await sendWhatsAppOtp(formatted, otpCode);
  if (!sendResult.success || sendResult.simulated) {
    otpStore.delete(formatted);
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
  const formatted = formatPortuguesePhone(rawPhone);
  const code = typeof inputCode === 'string' ? inputCode.trim() : '';

  if (!formatted) {
    return {
      success: false,
      message: 'Introduza um número de telemóvel português válido.',
      statusCode: 400,
    };
  }

  const stored = otpStore.get(formatted);

  if (!stored) {
    return {
      success: false,
      message: 'Código de verificação inexistente ou expirado. Solicite um novo código.',
      statusCode: 400,
    };
  }

  if (!isOtpActive(stored.expiresAt)) {
    otpStore.delete(formatted);
    return {
      success: false,
      message: 'O código de verificação expirou após 5 minutos. Solicite um novo código.',
      statusCode: 400,
    };
  }

  stored.attempts += 1;
  if (stored.attempts > 3) {
    otpStore.delete(formatted);
    return {
      success: false,
      message: 'Demasiadas tentativas incorretas. O código foi cancelado.',
      statusCode: 429,
    };
  }

  if (stored.code !== code) {
    return {
      success: false,
      message: 'Código de verificação incorreto.',
      statusCode: 401,
    };
  }

  // Código correto: remove do store
  otpStore.delete(formatted);

  // Consulta novamente a base de dados Supabase para obter os privilégios reais
  const dbUser = await findUserInSupabaseByPhone(formatted);
  if (!dbUser || !stored.userId || stored.userId !== dbUser.id) {
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
