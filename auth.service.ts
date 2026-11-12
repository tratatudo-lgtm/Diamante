// PATH: auth.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { sendWhatsAppOtp, formatPortuguesePhone } from './whatsapp.service';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET tem de estar configurado no servidor.');

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://ytpetuvvxbmlafsisfaf.supabase.co';

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY tem de estar configurada no servidor; nunca usar anon key como cliente admin.');
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

/**
 * Gera variantes normais de pesquisa para o número de telemóvel (ex: +351937230116, 351937230116, 937230116)
 */
function getPhoneVariants(rawPhone: string): string[] {
  const digits = rawPhone.replace(/\D/g, '');
  const variants = new Set<string>();

  if (!digits) return [];

  variants.add(digits);
  variants.add(`+${digits}`);

  if (digits.startsWith('351') && digits.length >= 12) {
    const national = digits.slice(3);
    variants.add(national);
    variants.add(`+351${national}`);
    variants.add(`351${national}`);
  } else if (digits.length === 9) {
    variants.add(`351${digits}`);
    variants.add(`+351${digits}`);
  }

  return Array.from(variants);
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
      if (matchedUser.ativo === false) return null;
      return {
        id: matchedUser.id,
        nome_completo: matchedUser.nome_completo || 'Funcionário Diamante',
        email: matchedUser.email || '',
        role: String(matchedUser.role || '').toLowerCase(),
        loja_id: matchedUser.loja_id || null,
        telemovel: matchedUser.telemovel || phone,
        ativo: true,
      };
    }
  } catch (err: any) {
    console.warn('[Auth Service] Erro na consulta Supabase por telemóvel:', err?.message);
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
      if (data.ativo === false) return null;
      return {
        id: data.id,
        nome_completo: data.nome_completo || 'Utilizador Diamante',
        email: data.email,
        role: String(data.role || '').toLowerCase(),
        loja_id: data.loja_id || null,
        telemovel: data.telemovel,
        ativo: true,
      };
    }


  } catch (err) {
    console.error('[Auth Service] Erro na consulta Supabase por email:', err);
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
    { expiresIn: '7d' }
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
  if (!formatted || formatted.length < 9) {
    return {
      success: false,
      message: 'Introduza um número de telemóvel válido.',
      statusCode: 400,
    };
  }

  // 1. Validação estrita contra a BD Supabase
  const user = await findUserInSupabaseByPhone(rawPhone);

  if (!user) {
    console.warn(`[Auth Service] Tentativa de OTP para número não registado/inativo: ${formatted}`);
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

  console.log(`[Auth Service] Utilizador verificado no Supabase (${user.nome_completo}, Role: ${user.role}). A enviar OTP.`);

  // 3. Envia código via Evolution API
  const sendResult = await sendWhatsAppOtp(formatted, otpCode);

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
  const code = inputCode.trim();

  const stored = otpStore.get(formatted);

  if (!stored) {
    return {
      success: false,
      message: 'Código de verificação inexistente ou expirado. Solicite um novo código.',
      statusCode: 400,
    };
  }

  if (Date.now() > stored.expiresAt) {
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
  const dbUser = await findUserInSupabaseByPhone(rawPhone);
  if (!dbUser || (stored.userId && stored.userId !== dbUser.id)) {
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
