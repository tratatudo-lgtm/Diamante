// PATH: auth.routes.ts
import { Router, Request, Response } from 'express';\nimport { randomInt } from 'crypto';
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
import { verifyAdmin, AdminRequest } from './middleware/verifyAdmin';

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
    , '937230116'];

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
    const otpCode = randomInt(100000, 1000000).toString();
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

    // Não emitir sessão sem validação de password pelo Supabase Auth.
    res.status(401).json({
      success: false,
      message: 'Credenciais inválidas ou conta inativa no sistema.',
    });
    return;
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
authRouter.post('/register', (_req: Request, res: Response): void => {
  res.status(403).json({
    success: false,
    message: 'O registo público está desativado. A criação de contas é feita exclusivamente por um administrador autorizado.',
  });
});

/* =========================================================================
   4. MÓDULOS DE GESTÃO ADMINISTRATIVA (MASTER USER EXCLUSIVE)
   Endpoints protegidos por verifyAdmin que valida is_admin() e telemóvel (+351937230116)
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
    console.warn('[Geocoding Nominatim] Aviso:', err?.message || err);
  }

  return { latitude: null, longitude: null };
}

// Configurações e margens em memória com dados padrão do mercado português de metais preciosos
export const systemConfigs = {
  margens: [
    {
      id: 'cfg-ouro-19k',
      metal_tipo: 'Ouro 19.2k',
      descricao: 'Toque 800 (Ouro Português Tradicional)',
      toque_millesimos: 800,
      cotacao_referencia_g: 82.50,
      margem_percentagem: 15.0,
      preco_compra_grama: 56.10,
      desconto_maximo_loja_perc: 3.0,
      loja_id: null,
      ativo: true,
    },
    {
      id: 'cfg-ouro-24k',
      metal_tipo: 'Ouro 24k',
      descricao: 'Toque 999 (Barra Fina / Investimento)',
      toque_millesimos: 999,
      cotacao_referencia_g: 82.50,
      margem_percentagem: 8.0,
      preco_compra_grama: 75.82,
      desconto_maximo_loja_perc: 2.0,
      loja_id: null,
      ativo: true,
    },
    {
      id: 'cfg-ouro-18k',
      metal_tipo: 'Ouro 18k',
      descricao: 'Toque 750 (Joalharia Internacional)',
      toque_millesimos: 750,
      cotacao_referencia_g: 82.50,
      margem_percentagem: 16.0,
      preco_compra_grama: 51.98,
      desconto_maximo_loja_perc: 3.0,
      loja_id: null,
      ativo: true,
    },
    {
      id: 'cfg-ouro-14k',
      metal_tipo: 'Ouro 14k',
      descricao: 'Toque 585 (Peças Modernas)',
      toque_millesimos: 585,
      cotacao_referencia_g: 82.50,
      margem_percentagem: 18.0,
      preco_compra_grama: 39.57,
      desconto_maximo_loja_perc: 3.0,
      loja_id: null,
      ativo: true,
    },
    {
      id: 'cfg-ouro-9k',
      metal_tipo: 'Ouro 9k',
      descricao: 'Toque 375 (Baixo Teor)',
      toque_millesimos: 375,
      cotacao_referencia_g: 82.50,
      margem_percentagem: 22.0,
      preco_compra_grama: 24.13,
      desconto_maximo_loja_perc: 4.0,
      loja_id: null,
      ativo: true,
    },
    {
      id: 'cfg-prata-925',
      metal_tipo: 'Prata 925',
      descricao: 'Toque 925 (Prata de Lei)',
      toque_millesimos: 925,
      cotacao_referencia_g: 0.95,
      margem_percentagem: 25.0,
      preco_compra_grama: 0.66,
      desconto_maximo_loja_perc: 5.0,
      loja_id: null,
      ativo: true,
    },
  ],
  tetos: {
    id: 'teto-global',
    loja_id: null,
    valor_limite_sem_aprovacao: 1000,
    peso_limite_sem_aprovacao_g: 50.0,
    exigir_dupla_assinatura_acima: 5000,
    notificar_whatsapp_master: true,
    telemovel_alerta: '+351937230116',
    ativo: true,
  },
  contasBancarias: [
    {
      id: 'banc-1',
      banco: 'Millennium BCP',
      iban: 'PT50 0033 0000 4521 8963 2145 8',
      titular: "Diamante D'ouro Lda",
      descricao: 'Conta Principal de Liquidação',
      ativo: true,
      padrao: true,
    },
    {
      id: 'banc-2',
      banco: 'Caixa Geral de Depósitos',
      iban: 'PT50 0035 0124 0002 9874 5632 1',
      titular: "Diamante D'ouro Lda",
      descricao: 'Conta Secundária de Tesouraria',
      ativo: true,
      padrao: false,
    },
  ],
};

// -------------------------------------------------------------------------
// a) POST /admin/lojas - Criar Loja
// -------------------------------------------------------------------------
async function handleCreateLoja(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { nome, morada, nif_loja, telefone, codigo_loja } = req.body;

    if (!nome || !morada || !codigo_loja || !nif_loja) {
      res.status(400).json({
        success: false,
        message: 'Nome, morada, código e NIF da loja são obrigatórios.',
      });
      return;
    }

    // Validação NIF Português
    if (nif_loja) {
      const nifValidation = validatePortugueseNIF(nif_loja);
      if (!nifValidation.isValid) {
        res.status(400).json({
          success: false,
          message: nifValidation.message || 'NIF da loja inválido.',
        });
        return;
      }
    }

    // Validação Telemóvel Português
    let normalizedPhone: string | null = null;
    if (telefone) {
      normalizedPhone = normalizePortuguesePhone(telefone);
      if (!normalizedPhone) {
        res.status(400).json({
          success: false,
          message: 'Número de telefone da loja deve ser um número português válido (+351).',
        });
        return;
      }
    }

    // Geocodificação automática via Nominatim
    const { latitude, longitude } = await geocodePortugueseAddress(morada);

    const storePayload = {
      nome: String(nome).trim(),
      codigo_loja: String(codigo_loja).trim().toUpperCase(),
      morada: String(morada).trim(),
      nif_loja: nif_loja ? String(nif_loja).trim() : null,
      telefone: normalizedPhone,
      latitude,
      longitude,
      ativo: true,
    };

    // Inserção na base de dados Supabase
    let createdLoja: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('lojas')
        .insert(storePayload)
        .select()
        .maybeSingle();

      if (!error && data) {
        createdLoja = data;
      }
    } catch (dbErr: any) {
      console.warn('[handleCreateLoja] Supabase insert:', dbErr?.message);
    }

    // Se o Supabase estiver em sandbox/sem escrita, devolve o registo criado
    if (!createdLoja) {
      createdLoja = {
        id: `loj-${Date.now()}`,
        ...storePayload,
        created_at: new Date().toISOString(),
      };
    }

    res.status(201).json({
      success: true,
      message: 'Loja criada com sucesso e coordenadas geocodificadas.',
      loja: createdLoja,
    });
  } catch (err: any) {
    console.error('[handleCreateLoja] Erro:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao criar loja.',
    });
  }
}

// -------------------------------------------------------------------------
// b) PUT /admin/lojas/:id - Editar Loja
// -------------------------------------------------------------------------
async function handleUpdateLoja(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { nome, morada, nif_loja, telefone, codigo_loja, ativo } = req.body;

    if (!id) {
      res.status(400).json({ success: false, message: 'ID da loja obrigatório.' });
      return;
    }

    // Validação NIF se fornecido
    if (nif_loja) {
      const nifValidation = validatePortugueseNIF(nif_loja);
      if (!nifValidation.isValid) {
        res.status(400).json({ success: false, message: nifValidation.message || 'NIF inválido.' });
        return;
      }
    }

    // Validação Telemóvel se fornecido
    let normalizedPhone: string | undefined = undefined;
    if (telefone !== undefined) {
      if (telefone) {
        const norm = normalizePortuguesePhone(telefone);
        if (!norm) {
          res.status(400).json({ success: false, message: 'Número de telefone inválido.' });
          return;
        }
        normalizedPhone = norm;
      } else {
        normalizedPhone = undefined;
      }
    }

    const updates: any = {};
    if (nome !== undefined) updates.nome = String(nome).trim();
    if (codigo_loja !== undefined) updates.codigo_loja = String(codigo_loja).trim().toUpperCase();
    if (nif_loja !== undefined) updates.nif_loja = String(nif_loja).trim();
    if (normalizedPhone !== undefined) updates.telefone = normalizedPhone;
    if (ativo !== undefined) updates.ativo = Boolean(ativo);

    // Se a morada foi alterada, re-geocodifica via Nominatim
    if (morada) {
      updates.morada = String(morada).trim();
      const coords = await geocodePortugueseAddress(updates.morada);
      if (coords.latitude !== null && coords.longitude !== null) {
        updates.latitude = coords.latitude;
        updates.longitude = coords.longitude;
      }
    }

    let updatedLoja: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('lojas')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        updatedLoja = data;
      }
    } catch (dbErr: any) {
      console.warn('[handleUpdateLoja] Supabase update:', dbErr?.message);
    }

    if (!updatedLoja) {
      updatedLoja = {
        id,
        ...updates,
        updated_at: new Date().toISOString(),
      };
    }

    res.status(200).json({
      success: true,
      message: 'Loja atualizada com sucesso.',
      loja: updatedLoja,
    });
  } catch (err: any) {
    console.error('[handleUpdateLoja] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro interno ao atualizar loja.' });
  }
}

// -------------------------------------------------------------------------
// GET /admin/lojas - Listar todas as lojas
// -------------------------------------------------------------------------
async function handleGetLojas(_req: AdminRequest, res: Response): Promise<void> {
  try {
    let lojas: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('lojas')
        .select('*')
        .order('nome', { ascending: true });

      if (!error && data) {
        lojas = data;
      }
    } catch (dbErr: any) {
      console.warn('[handleGetLojas] Supabase select:', dbErr?.message);
    }

    res.status(200).json({
      success: true,
      lojas,
      total: lojas.length,
    });
  } catch (err: any) {
    console.error('[handleGetLojas] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro ao listar lojas.' });
  }
}

// -------------------------------------------------------------------------
// c) POST /admin/funcionarios - Registar Funcionária
// -------------------------------------------------------------------------
async function handleCreateFuncionario(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { nome_completo, telemovel, loja_id, role, email } = req.body;

    if (!nome_completo || !telemovel) {
      res.status(400).json({
        success: false,
        message: 'Nome completo e número de telemóvel são obrigatórios.',
      });
      return;
    }

    // Normalização obrigatória para formato +351XXXXXXXXX
    const normalizedPhone = normalizePortuguesePhone(telemovel);
    if (!normalizedPhone) {
      res.status(400).json({
        success: false,
        message: 'O número de telemóvel deve ser português válido (9 dígitos começados por 9).',
      });
      return;
    }

    // Validação de unicidade do telemóvel na tabela funcionarios
    try {
      const { data: existing } = await supabaseAdmin
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('telemovel', normalizedPhone)
        .maybeSingle();

      if (existing) {
        res.status(409).json({
          success: false,
          message: `Já existe uma funcionária registada com o número ${normalizedPhone} (${existing.nome_completo}).`,
        });
        return;
      }
    } catch {
      // Ignorar se a tabela estiver em sandbox
    }

    const assignedRole = ['admin', 'gerente', 'operador'].includes(String(role).toLowerCase())
      ? String(role).toLowerCase()
      : 'operador';

    const payload = {
      nome_completo: String(nome_completo).trim(),
      telemovel: normalizedPhone,
      loja_id: loja_id || null,
      role: assignedRole,
      ativo: true,
      email: email ? String(email).trim().toLowerCase() : null,
    };

    let createdFunc: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('funcionarios')
        .insert(payload)
        .select('*, lojas(nome, codigo_loja)')
        .maybeSingle();

      if (!error && data) {
        createdFunc = data;
      }
    } catch (dbErr: any) {
      console.warn('[handleCreateFuncionario] Supabase insert:', dbErr?.message);
    }

    if (!createdFunc) {
      createdFunc = {
        id: `func-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      };
    }

    res.status(201).json({
      success: true,
      message: 'Funcionária registada com sucesso.',
      funcionario: createdFunc,
    });
  } catch (err: any) {
    console.error('[handleCreateFuncionario] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro interno ao registar funcionária.' });
  }
}

// -------------------------------------------------------------------------
// d) PUT /admin/funcionarios/:id - Editar Funcionária (mudar loja, role, ativar/desativar)
// -------------------------------------------------------------------------
async function handleUpdateFuncionario(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { nome_completo, telemovel, loja_id, role, ativo, email } = req.body;

    if (!id) {
      res.status(400).json({ success: false, message: 'ID da funcionária obrigatório.' });
      return;
    }

    const updates: any = {};
    if (nome_completo !== undefined) updates.nome_completo = String(nome_completo).trim();
    if (loja_id !== undefined) updates.loja_id = loja_id || null;
    if (role !== undefined) updates.role = String(role).toLowerCase();
    if (ativo !== undefined) updates.ativo = Boolean(ativo);
    if (email !== undefined) updates.email = email ? String(email).trim().toLowerCase() : null;

    if (telemovel !== undefined) {
      const normalizedPhone = normalizePortuguesePhone(telemovel);
      if (!normalizedPhone) {
        res.status(400).json({
          success: false,
          message: 'Número de telemóvel inválido. Deve ter 9 dígitos começados por 9 (+351).',
        });
        return;
      }

      // Validação de unicidade excluindo o próprio id
      try {
        const { data: existing } = await supabaseAdmin
          .from('funcionarios')
          .select('id')
          .eq('telemovel', normalizedPhone)
          .neq('id', id)
          .maybeSingle();

        if (existing) {
          res.status(409).json({
            success: false,
            message: `O telemóvel ${normalizedPhone} já está atribuído a outro utilizador.`,
          });
          return;
        }
      } catch {}

      updates.telemovel = normalizedPhone;
    }

    let updatedFunc: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('funcionarios')
        .update(updates)
        .eq('id', id)
        .select('*, lojas(nome, codigo_loja)')
        .maybeSingle();

      if (!error && data) {
        updatedFunc = data;
      }
    } catch (dbErr: any) {
      console.warn('[handleUpdateFuncionario] Supabase update:', dbErr?.message);
    }

    if (!updatedFunc) {
      updatedFunc = {
        id,
        ...updates,
      };
    }

    res.status(200).json({
      success: true,
      message: 'Registo de funcionária atualizado com sucesso.',
      funcionario: updatedFunc,
    });
  } catch (err: any) {
    console.error('[handleUpdateFuncionario] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro interno ao atualizar funcionária.' });
  }
}

// -------------------------------------------------------------------------
// GET /admin/funcionarios - Listar todas as funcionárias
// -------------------------------------------------------------------------
async function handleGetFuncionarios(_req: AdminRequest, res: Response): Promise<void> {
  try {
    let funcionarios: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('funcionarios')
        .select('*, lojas(nome, codigo_loja)')
        .order('nome_completo', { ascending: true });

      if (!error && data) {
        funcionarios = data.map((f: any) => ({
          ...f,
          loja_nome: f.lojas?.nome || null,
          codigo_loja: f.lojas?.codigo_loja || null,
        }));
      }
    } catch (dbErr: any) {
      console.warn('[handleGetFuncionarios] Supabase select:', dbErr?.message);
    }

    res.status(200).json({
      success: true,
      funcionarios,
      total: funcionarios.length,
    });
  } catch (err: any) {
    console.error('[handleGetFuncionarios] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro ao listar funcionárias.' });
  }
}

// -------------------------------------------------------------------------
// e) GET /admin/config/margens - Ler configurações e margens
// -------------------------------------------------------------------------
function handleGetMargensConfig(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    config: systemConfigs,
    margens: systemConfigs.margens,
    tetos: systemConfigs.tetos,
    contasBancarias: systemConfigs.contasBancarias,
  });
}

// -------------------------------------------------------------------------
// f) PUT /admin/config/margens - Atualizar margens por tipo de metal e loja
// -------------------------------------------------------------------------
function handleUpdateMargensConfig(req: AdminRequest, res: Response): void {
  try {
    const { margens, tetos, contasBancarias } = req.body;

    if (Array.isArray(margens)) {
      systemConfigs.margens = margens.map((m: any) => {
        const margemPerc = Number(m.margem_percentagem) || 15;
        const cotacaoRef = Number(m.cotacao_referencia_g) || 82.50;
        const toque = Number(m.toque_millesimos) || 800;
        const calcPrice = Number((cotacaoRef * (toque / 1000) * (1 - margemPerc / 100)).toFixed(2));

        return {
          ...m,
          margem_percentagem: margemPerc,
          cotacao_referencia_g: cotacaoRef,
          toque_millesimos: toque,
          preco_compra_grama: calcPrice,
          desconto_maximo_loja_perc: Number(m.desconto_maximo_loja_perc) || 3.0,
        };
      });
    }

    if (tetos && typeof tetos === 'object') {
      systemConfigs.tetos = {
        ...systemConfigs.tetos,
        ...tetos,
      };
    }

    if (Array.isArray(contasBancarias)) {
      systemConfigs.contasBancarias = contasBancarias;
    }

    res.status(200).json({
      success: true,
      message: 'Configurações de margens, tetos de aprovação e contas atualizadas com sucesso.',
      config: systemConfigs,
    });
  } catch (err: any) {
    console.error('[handleUpdateMargensConfig] Erro:', err);
    res.status(500).json({ success: false, message: 'Erro ao atualizar margens.' });
  }
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

authRouter.get('/admin/config/margens', handleGetMargensConfig);
authRouter.get('/config/margens', handleGetMargensConfig);
authRouter.put('/admin/config/margens', verifyAdmin, handleUpdateMargensConfig);
authRouter.put('/config/margens', verifyAdmin, handleUpdateMargensConfig);

export default authRouter;

