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
authRouter.post('/change-password', verifyAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const employee = req.authenticatedUser;
  const password = req.body?.password;
  if (!employee?.ativo) {
    res.status(403).json({ success: false, message: 'A conta não está autorizada a alterar credenciais.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72 ||
      password.trim().length < 8) {
    res.status(400).json({ success: false, message: 'A palavra-passe deve ter entre 8 e 72 caracteres e não pode ser apenas espaços.' });
    return;
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(employee.id, { password });
    if (error) {
      console.error('[AUTH PASSWORD] O fornecedor recusou a alteração da palavra-passe.');
      res.status(400).json({ success: false, message: 'Não foi possível actualizar a palavra-passe. Verifique os requisitos de segurança.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Palavra-passe alterada com sucesso.' });
  } catch {
    console.error('[AUTH PASSWORD] Erro interno ao alterar credenciais.');
    res.status(500).json({ success: false, message: 'Erro interno ao alterar a palavra-passe.' });
  }
});

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

// a) POST /admin/lojas - Criar Loja
// -------------------------------------------------------------------------
async function handleCreateLoja(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { nome, morada, nif_loja, telefone, codigo_loja } = req.body || {};
    if (!nome || !morada || !codigo_loja || !nif_loja) {
      res.status(400).json({ success: false, message: 'Nome, morada, código e NIF são obrigatórios.' });
      return;
    }
    const nifValidation = validatePortugueseNIF(String(nif_loja));
    if (!nifValidation.isValid) {
      res.status(400).json({ success: false, message: nifValidation.message || 'NIF inválido.' });
      return;
    }
    let normalizedPhone: string | null = null;
    if (telefone) {
      normalizedPhone = normalizePortuguesePhone(String(telefone));
      if (!normalizedPhone) {
        res.status(400).json({ success: false, message: 'Telefone português inválido.' });
        return;
      }
    }
    const { latitude, longitude } = await geocodePortugueseAddress(String(morada));
    const payload = {
      nome: String(nome).trim(),
      morada: String(morada).trim(),
      codigo_loja: String(codigo_loja).trim().toUpperCase(),
      nif_loja: String(nif_loja).trim(),
      telefone: normalizedPhone,
      latitude,
      longitude,
      ativo: true,
    };
    const { data, error } = await supabaseAdmin
      .from('lojas')
      .insert(payload)
      .select('id, nome, morada, nif_loja, telefone, codigo_loja, latitude, longitude, ativo')
      .single();
    if (error) {
      console.error('[handleCreateLoja] Falha na gravação da loja.');
      res.status(400).json({ success: false, message: 'Não foi possível criar a loja.' });
      return;
    }
    res.status(201).json({ success: true, message: 'Loja criada.', loja: data });
  } catch (err: any) {
    console.error('[handleCreateLoja] Falha interna.');
    res.status(500).json({ success: false, message: 'Erro interno ao criar loja.' });
  }
}

// -------------------------------------------------------------------------
// b) PUT /admin/lojas/:id - Editar Loja
// -------------------------------------------------------------------------
async function handleUpdateLoja(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, message: 'ID da loja obrigatório.' });
      return;
    }
    const { nome, morada, nif_loja, telefone, codigo_loja, ativo } = req.body || {};
    const updates: any = {};
    if (nome !== undefined) updates.nome = String(nome).trim();
    if (codigo_loja !== undefined) updates.codigo_loja = String(codigo_loja).trim().toUpperCase();
    if (nif_loja !== undefined) {
      const validation = validatePortugueseNIF(String(nif_loja));
      if (!validation.isValid) {
        res.status(400).json({ success: false, message: validation.message || 'NIF inválido.' });
        return;
      }
      updates.nif_loja = String(nif_loja).trim();
    }
    if (telefone !== undefined) {
      if (telefone === null || telefone === '') updates.telefone = null;
      else {
        const normalized = normalizePortuguesePhone(String(telefone));
        if (!normalized) {
          res.status(400).json({ success: false, message: 'Telefone português inválido.' });
          return;
        }
        updates.telefone = normalized;
      }
    }
    if (ativo !== undefined) {
      if (typeof ativo !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'O campo ativo tem de ser um valor booleano.',
        });
        return;
      }
      updates.ativo = ativo;
    }
    if (morada !== undefined) {
      updates.morada = String(morada).trim();
      const coords = await geocodePortugueseAddress(updates.morada);
      if (coords.latitude !== null && coords.longitude !== null) {
        updates.latitude = coords.latitude;
        updates.longitude = coords.longitude;
      }
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'Não foram enviados campos para atualizar.' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('lojas')
      .update(updates)
      .eq('id', id)
      .select('id, nome, morada, nif_loja, telefone, codigo_loja, latitude, longitude, ativo')
      .maybeSingle();
    if (error) {
      res.status(400).json({ success: false, message: 'Não foi possível atualizar a loja.' });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Loja não encontrada.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Loja atualizada.', loja: data });
  } catch (err: any) {
    console.error('[handleUpdateLoja] Falha interna.');
    res.status(500).json({ success: false, message: 'Erro interno ao atualizar loja.' });
  }
}

// -------------------------------------------------------------------------
// GET /admin/lojas - Listar todas as lojas
// -------------------------------------------------------------------------
async function handleGetLojas(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('lojas')
      .select('id, nome, morada, nif_loja, telefone, codigo_loja, latitude, longitude, ativo, admin_id')
      .order('nome', { ascending: true });
    if (error) {
      console.error('[handleGetLojas] Falha na consulta de lojas.');
      res.status(503).json({ success: false, message: 'Não foi possível consultar as lojas.' });
      return;
    }
    res.status(200).json({ success: true, lojas: data || [], total: data?.length || 0 });
  } catch (err: any) {
    console.error('[handleGetLojas] Falha interna.');
    res.status(500).json({ success: false, message: 'Erro ao listar lojas.' });
  }
}

// -------------------------------------------------------------------------
// c) POST /admin/funcionarios - Registar Funcionária
// -------------------------------------------------------------------------
async function handleCreateFuncionario(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { nome_completo, telemovel, loja_id, role, email } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!nome_completo || !normalizedEmail) {
      res.status(400).json({ success: false, message: 'Nome completo e email são obrigatórios.' });
      return;
    }
    const assignedRole = String(role || 'funcionario').toLowerCase();
    if (!['admin', 'funcionario'].includes(assignedRole)) {
      res.status(400).json({
        success: false,
        message: 'Papel inválido. Apenas admin e funcionario podem ser atribuídos a novas contas.',
      });
      return;
    }
    let normalizedPhone: string | null = null;
    if (telemovel) {
      normalizedPhone = normalizePortuguesePhone(String(telemovel));
      if (!normalizedPhone) {
        res.status(400).json({ success: false, message: 'Número de telemóvel português inválido.' });
        return;
      }
    }
    if (loja_id) {
      const { data: store, error: storeError } = await supabaseAdmin
        .from('lojas').select('id').eq('id', loja_id).maybeSingle();
      if (storeError || !store) {
        res.status(400).json({ success: false, message: 'A loja indicada não existe.' });
        return;
      }
    }
    const { data: existing } = await supabaseAdmin
      .from('funcionarios').select('id').eq('email', normalizedEmail).maybeSingle();
    if (existing) {
      res.status(409).json({ success: false, message: 'Já existe um funcionário com esse email.' });
      return;
    }

    // Criar primeiro a identidade Auth por convite; o trigger existente associa-a pelo email.
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { data: { nome_completo: String(nome_completo).trim() } }
    );
    if (inviteError || !invited.user) {
      console.error('[handleCreateFuncionario] Falha ao criar convite Auth.');
      res.status(400).json({
        success: false,
        message: 'Não foi possível convidar o utilizador.',
      });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .insert({
        id: invited.user.id,
        nome_completo: String(nome_completo).trim(),
        email: normalizedEmail,
        telemovel: normalizedPhone,
        loja_id: loja_id || null,
        role: assignedRole,
        ativo: true,
      })
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo')
      .single();

    if (error || !data) {
      const { error: rollbackError } =
        await supabaseAdmin.auth.admin.deleteUser(invited.user.id);

      if (rollbackError) {
        console.error('[handleCreateFuncionario] Falha ao reverter identidade Auth.');
        res.status(500).json({
          success: false,
          message: 'A gravação falhou e a reversão automática requer intervenção.',
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Não foi possível gravar o funcionário. O convite Auth foi revertido.',
      });
      return;
    }
    if (data.id !== invited.user.id) {
      console.error('[handleCreateFuncionario] Divergência entre identidade Auth e funcionário; requer reconciliação.');
      res.status(409).json({
        success: false,
        message: 'A associação Auth/funcionário não ficou consistente. É necessária reconciliação manual.',
      });
      return;
    }
    res.status(201).json({ success: true, message: 'Funcionário criado e convite enviado.', funcionario: data });
  } catch (err: any) {
    console.error('[handleCreateFuncionario] Falha interna.');
    res.status(500).json({ success: false, message: 'Erro interno ao registar funcionário.' });
  }
}

// -------------------------------------------------------------------------
// d) PUT /admin/funcionarios/:id - Editar Funcionária (mudar loja, role, ativar/desativar)
// -------------------------------------------------------------------------
async function handleUpdateFuncionario(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, message: 'ID do funcionário obrigatório.' });
      return;
    }
    const { nome_completo, telemovel, loja_id, role, ativo, email } = req.body || {};
    if (email !== undefined) {
      res.status(409).json({
        success: false,
        message: 'A alteração de email está temporariamente bloqueada para evitar dessincronização entre Auth e funcionarios. Requer fluxo próprio de alteração de identidade.',
      });
      return;
    }
    const updates: any = {};
    if (nome_completo !== undefined) updates.nome_completo = String(nome_completo).trim();
    if (loja_id !== undefined) updates.loja_id = loja_id || null;
    if (role !== undefined) {
      const normalizedRole = String(role).toLowerCase();
      if (!['admin', 'funcionario', 'aprovador'].includes(normalizedRole)) {
        res.status(400).json({ success: false, message: 'Papel inválido para a constraint atual da base de dados.' });
        return;
      }
      if (normalizedRole === 'aprovador') {
        const { data: currentFuncionario, error: currentFuncionarioError } = await supabaseAdmin
          .from('funcionarios')
          .select('role')
          .eq('id', id)
          .maybeSingle();
        if (currentFuncionarioError || currentFuncionario?.role !== 'aprovador') {
          res.status(403).json({
            success: false,
            message: 'O perfil legado de aprovador não pode ser atribuído. Apenas administradores aprovam operações.',
          });
          return;
        }
      }
      updates.role = normalizedRole;
    }
    if (ativo !== undefined) {
      if (typeof ativo !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'O campo ativo tem de ser um valor booleano.',
        });
        return;
      }
      updates.ativo = ativo;
    }
    if (telemovel !== undefined) {
      if (telemovel === null || telemovel === '') updates.telemovel = null;
      else {
        const normalizedPhone = normalizePortuguesePhone(String(telemovel));
        if (!normalizedPhone) {
          res.status(400).json({ success: false, message: 'Número de telemóvel português inválido.' });
          return;
        }
        updates.telemovel = normalizedPhone;
      }
    }
    if (loja_id) {
      const { data: store, error: storeError } = await supabaseAdmin
        .from('lojas').select('id').eq('id', loja_id).maybeSingle();
      if (storeError || !store) {
        res.status(400).json({ success: false, message: 'A loja indicada não existe.' });
        return;
      }
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'Não foram enviados campos para atualizar.' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .update(updates)
      .eq('id', id)
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo')
      .maybeSingle();
    if (error) {
      res.status(400).json({ success: false, message: 'Não foi possível atualizar o funcionário.' });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Funcionário não encontrado.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Funcionário atualizado.', funcionario: data });
  } catch (err: any) {
    console.error('[handleUpdateFuncionario] Falha interna.');
    res.status(500).json({ success: false, message: 'Erro interno ao atualizar funcionário.' });
  }
}

// -------------------------------------------------------------------------
// GET /admin/funcionarios - Listar todas as funcionárias
// -------------------------------------------------------------------------
async function handleGetFuncionarios(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo, lojas(nome, codigo_loja)')
      .order('nome_completo', { ascending: true });
    if (error) {
      console.error('[handleGetFuncionarios] Falha na consulta de funcionários.');
      res.status(503).json({ success: false, message: 'Não foi possível consultar os funcionários.' });
      return;
    }
    const funcionarios = (data || []).map((f: any) => ({
      id: f.id,
      nome_completo: f.nome_completo,
      email: f.email,
      role: f.role,
      loja_id: f.loja_id,
      telemovel: f.telemovel,
      ativo: f.ativo,
      loja_nome: f.lojas?.nome || null,
      codigo_loja: f.lojas?.codigo_loja || null,
    }));
    res.status(200).json({ success: true, funcionarios, total: funcionarios.length });
  } catch (err: any) {
    console.error('[handleGetFuncionarios] Falha interna.');
    res.status(500).json({ success: false, message: 'Erro ao listar funcionários.' });
  }
}

// -------------------------------------------------------------------------
// e) GET /admin/config/margens - Ler e guardar parâmetros comerciais
// -------------------------------------------------------------------------
const DEFAULT_BUSINESS_SETTINGS = {
  margens: [],
  tetos: {
    id: '',
    loja_id: null,
    valor_limite_sem_aprovacao: 0,
    peso_limite_sem_aprovacao_g: 0,
    exigir_dupla_assinatura_acima: 0,
    notificar_whatsapp_master: false,
    telemovel_alerta: '',
    ativo: false,
  },
  contasBancarias: [],
};

async function handleGetMargensConfig(_req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'parametros_compra_ouro')
      .maybeSingle();

    if (error) {
      console.error('[Admin Purchase Settings] Falha ao consultar parâmetros.');
      res.status(503).json({ success: false, message: 'Não foi possível carregar os parâmetros de compra.' });
      return;
    }

    const stored = data?.valor && typeof data.valor === 'object' && !Array.isArray(data.valor)
      ? data.valor
      : {};
    res.status(200).json({
      success: true,
      margens: Array.isArray(stored.margens) ? stored.margens : DEFAULT_BUSINESS_SETTINGS.margens,
      tetos: stored.tetos && typeof stored.tetos === 'object' ? stored.tetos : DEFAULT_BUSINESS_SETTINGS.tetos,
      contasBancarias: Array.isArray(stored.contasBancarias) ? stored.contasBancarias : DEFAULT_BUSINESS_SETTINGS.contasBancarias,
    });
  } catch {
    console.error('[Admin Purchase Settings] Erro interno ao consultar parâmetros.');
    res.status(500).json({ success: false, message: 'Erro interno ao carregar os parâmetros de compra.' });
  }
}

async function handleUpdateMargensConfig(req: AdminRequest, res: Response): Promise<void> {
  const settings = req.body;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
      !Array.isArray(settings.margens) || !Array.isArray(settings.contasBancarias) ||
      !settings.tetos || typeof settings.tetos !== 'object' || Array.isArray(settings.tetos)) {
    res.status(400).json({ success: false, message: 'Estrutura dos parâmetros de negócio inválida.' });
    return;
  }

  const validMargins = settings.margens.every((item: any) =>
    item && typeof item.id === 'string' && item.id.length <= 100 &&
    typeof item.metal_tipo === 'string' && item.metal_tipo.trim().length > 0 && item.metal_tipo.length <= 100 &&
    typeof item.descricao === 'string' && item.descricao.length <= 500 &&
    Number.isInteger(item.toque_millesimos) && item.toque_millesimos > 0 && item.toque_millesimos <= 1000 &&
    Number.isFinite(item.cotacao_referencia_g) && item.cotacao_referencia_g >= 0 && item.cotacao_referencia_g <= 100000 &&
    Number.isFinite(item.margem_percentagem) && item.margem_percentagem >= 0 && item.margem_percentagem <= 100 &&
    Number.isFinite(item.desconto_maximo_loja_perc) && item.desconto_maximo_loja_perc >= 0 && item.desconto_maximo_loja_perc <= 100 &&
    (item.loja_id === null || item.loja_id === undefined || typeof item.loja_id === 'string') &&
    typeof item.ativo === 'boolean'
  );

  const t = settings.tetos;
  const validThresholds =
    Number.isFinite(t.valor_limite_sem_aprovacao) && t.valor_limite_sem_aprovacao >= 0 &&
    Number.isFinite(t.peso_limite_sem_aprovacao_g) && t.peso_limite_sem_aprovacao_g >= 0 &&
    Number.isFinite(t.exigir_dupla_assinatura_acima) && t.exigir_dupla_assinatura_acima >= 0 &&
    typeof t.notificar_whatsapp_master === 'boolean' &&
    typeof t.ativo === 'boolean' &&
    (t.telemovel_alerta === undefined || (typeof t.telemovel_alerta === 'string' && t.telemovel_alerta.length <= 40));

  const validAccounts = settings.contasBancarias.every((item: any) =>
    item && typeof item.id === 'string' && item.id.length <= 100 &&
    typeof item.banco === 'string' && item.banco.length <= 120 &&
    typeof item.iban === 'string' && item.iban.length <= 64 &&
    typeof item.titular === 'string' && item.titular.length <= 200 &&
    (item.descricao === undefined || (typeof item.descricao === 'string' && item.descricao.length <= 500)) &&
    typeof item.ativo === 'boolean' && typeof item.padrao === 'boolean'
  );

  if (!validMargins || settings.margens.length > 100 ||
      !validThresholds || !validAccounts || settings.contasBancarias.length > 30 ||
      settings.margens.filter((item: any) => item.ativo && item.loja_id == null).length > 30) {
    res.status(400).json({ success: false, message: 'Existem margens, limites ou contas bancárias com valores inválidos.' });
    return;
  }

  try {
    const { data: currentConfig, error: currentConfigError } = await supabaseAdmin
      .from('configuracoes_sistema')
      .select('valor')
      .eq('chave', 'parametros_compra_ouro')
      .maybeSingle();
    if (currentConfigError) {
      console.error('[Admin Purchase Settings] Falha ao consultar cotação anterior.');
      res.status(503).json({ success: false, message: 'Não foi possível confirmar a cotação anterior.' });
      return;
    }

    const previousMargins = Array.isArray(currentConfig?.valor?.margens) ? currentConfig.valor.margens : [];
    const savedAt = new Date().toISOString();
    const confirmQuotesToday = req.body?.confirmarCotacoesHoje === true;
    const payload = {
      margens: settings.margens.map((item: any) => {
        const previous = previousMargins.find((candidate: any) =>
          candidate?.id === item.id &&
          (candidate?.loja_id ?? null) === (item.loja_id ?? null) &&
          Number(candidate?.toque_millesimos) === item.toque_millesimos &&
          Number(candidate?.cotacao_referencia_g) === item.cotacao_referencia_g &&
          ['referencia_manual_sede', 'xaus.com'].includes(candidate?.cotacao_origem) &&
          candidate?.cotacao_moeda === 'EUR' &&
          candidate?.cotacao_unidade === 'EUR/g_ouro_fino' &&
          typeof candidate?.cotacao_observada_em === 'string'
        );
        return {
          ...item,
          metal_tipo: item.metal_tipo.trim(),
          preco_compra_grama: Number((item.cotacao_referencia_g * (item.toque_millesimos / 1000) * (1 - item.margem_percentagem / 100)).toFixed(2)),
          cotacao_origem: confirmQuotesToday || !previous ? 'referencia_manual_sede' : previous.cotacao_origem,
          cotacao_moeda: 'EUR',
          cotacao_unidade: 'EUR/g_ouro_fino',
          cotacao_observada_em: confirmQuotesToday || !previous ? savedAt : previous.cotacao_observada_em,
          ...(previous?.cotacao_origem === 'xaus.com' && !confirmQuotesToday && previous?.cotacao_recebida_em
            ? { cotacao_recebida_em: previous.cotacao_recebida_em }
            : {}),
        };
      }),
      tetos: settings.tetos,
      contasBancarias: settings.contasBancarias,
    };
    const { data, error } = await supabaseAdmin
      .from('configuracoes_sistema')
      .upsert({
        chave: 'parametros_compra_ouro',
        valor: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave' })
      .select('valor')
      .single();

    if (error || !data) {
      console.error('[Admin Purchase Settings] Falha ao guardar parâmetros.');
      res.status(503).json({ success: false, message: 'Não foi possível guardar os parâmetros de compra.' });
      return;
    }
    res.status(200).json({
      success: true,
      margens: data.valor.margens,
      tetos: data.valor.tetos,
      contasBancarias: data.valor.contasBancarias,
    });
  } catch {
    console.error('[Admin Purchase Settings] Erro interno ao guardar parâmetros.');
    res.status(500).json({ success: false, message: 'Erro interno ao guardar os parâmetros de compra.' });
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

authRouter.get('/admin/audit-logs', verifyAdmin, async (req: AdminRequest, res: Response): Promise<void> => {
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
  try {
    const { data, error } = await supabaseAdmin
      .from('auditoria_logs')
      .select('id, funcionario_id, acao, tabela_afetada, registo_id, detalhes_antigos, detalhes_novos, ip_origem, created_at, funcionarios(nome_completo, role, telemovel, loja_id)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[Admin Audit] Falha ao consultar auditoria.');
      res.status(503).json({ success: false, message: 'Não foi possível consultar o histórico de auditoria.' });
      return;
    }
    res.status(200).json({ success: true, logs: data || [], total: data?.length || 0 });
  } catch {
    console.error('[Admin Audit] Erro interno ao consultar auditoria.');
    res.status(500).json({ success: false, message: 'Erro interno ao consultar o histórico de auditoria.' });
  }
});

async function handleImportGoldMarketQuote(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const response = await fetch('https://xaus.com/api/v1/spot?currency=EUR&unit=gram&compact=1&fresh=' + Date.now(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    const quote: any = await response.json().catch(() => null);
    if (!response.ok || !quote || quote.data_state?.status !== 'fresh' ||
        !['xaus.com'].includes(quote.price_source || quote.source) || quote.fx_stale === true ||
        quote.xau?.currency !== 'EUR' || quote.xau?.unit !== 'gram' ||
        !Number.isFinite(quote.xau?.price) || quote.xau.price <= 0 ||
        typeof quote.price_as_of !== 'string' || Number.isNaN(Date.parse(quote.price_as_of)) ||
        typeof quote.updated_at !== 'string' || Number.isNaN(Date.parse(quote.updated_at))) {
      res.status(503).json({ success: false, message: 'A fonte não devolveu uma cotação EUR/g fresca e verificável. Nenhum preço foi alterado.' });
      return;
    }

    const now = Date.now();
    const observedAt = Date.parse(quote.price_as_of);
    const generatedAt = Date.parse(quote.updated_at);
    if (observedAt > now + 30000 || generatedAt > now + 30000 ||
        now - observedAt > 5 * 60 * 1000 || now - generatedAt > 2 * 60 * 1000 ||
        Math.abs(generatedAt - observedAt) > 5 * 60 * 1000) {
      res.status(503).json({ success: false, message: 'A cotação recebida está desactualizada ou tem timestamps inconsistentes. Nenhum preço foi alterado.' });
      return;
    }

    const { data: currentConfig, error: readError } = await supabaseAdmin
      .from('configuracoes_sistema').select('valor').eq('chave', 'parametros_compra_ouro').maybeSingle();
    if (readError || !currentConfig?.valor || !Array.isArray(currentConfig.valor.margens)) {
      res.status(503).json({ success: false, message: 'Não foi possível carregar as margens actuais. Nenhum preço foi alterado.' });
      return;
    }

    const price = Number(quote.xau.price);
    const margins = currentConfig.valor.margens.map((item: any) => ({
      ...item,
      cotacao_referencia_g: price,
      preco_compra_grama: Number((price * (Number(item.toque_millesimos) / 1000) * (1 - Number(item.margem_percentagem) / 100)).toFixed(2)),
      cotacao_origem: 'xaus.com',
      cotacao_moeda: 'EUR',
      cotacao_unidade: 'EUR/g_ouro_fino',
      cotacao_observada_em: quote.price_as_of,
      cotacao_recebida_em: quote.updated_at,
    }));
    const payload = { ...currentConfig.valor, margens };
    const { data: historyId, error: importError } = await supabaseAdmin.rpc('importar_cotacao_ouro', {
      p_configuracao: payload,
      p_fonte: 'xaus.com',
      p_preco: price,
      p_observada_em: quote.price_as_of,
      p_recebida_em: quote.updated_at,
      p_margens_snapshot: margins,
      p_estado_fonte: quote.data_state,
    });
    if (importError || typeof historyId !== 'string') {
      console.error('[Admin Gold Quote] Falha na importação transaccional da cotação.');
      res.status(503).json({ success: false, message: 'Não foi possível activar e auditar a cotação. Os preços activos não foram alterados.' });
      return;
    }
    const data = { valor: payload };
    res.status(200).json({
      success: true,
      historico_id: historyId,
      fonte: 'xaus.com',
      cotacao_referencia_g: price,
      moeda: 'EUR',
      unidade: 'EUR/g_ouro_fino',
      cotacao_observada_em: quote.price_as_of,
      cotacao_recebida_em: quote.updated_at,
      data_state: quote.data_state,
      margens: data.valor.margens,
    });
  } catch {
    console.error('[Admin Gold Quote] Falha ao importar cotação de mercado.');
    res.status(503).json({ success: false, message: 'Não foi possível obter uma cotação de mercado verificável. Nenhum preço foi alterado.' });
  }
}

authRouter.get('/admin/config/cotacao-ouro/historico', verifyAdmin, async (_req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cotacoes_ouro_historico')
      .select('id, fonte, preco_referencia, moeda, unidade, observada_em, recebida_em, importada_em, margens_snapshot')
      .order('importada_em', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[Admin Gold Quote] Falha ao consultar histórico.');
      res.status(503).json({ success: false, message: 'Não foi possível consultar o histórico de cotações.' });
      return;
    }
    res.status(200).json({ success: true, cotacoes: data || [] });
  } catch {
    console.error('[Admin Gold Quote] Erro interno ao consultar histórico.');
    res.status(500).json({ success: false, message: 'Erro interno ao consultar histórico de cotações.' });
  }
});

authRouter.post('/admin/config/cotacao-ouro/importar', verifyAdmin, handleImportGoldMarketQuote);\nauthRouter.post('/config/cotacao-ouro/importar', verifyAdmin, handleImportGoldMarketQuote);\nauthRouter.get('/admin/config/margens', verifyAdmin, handleGetMargensConfig);
authRouter.get('/config/margens', verifyAdmin, handleGetMargensConfig);
authRouter.put('/admin/config/margens', verifyAdmin, handleUpdateMargensConfig);
authRouter.put('/config/margens', verifyAdmin, handleUpdateMargensConfig);

export default authRouter;

