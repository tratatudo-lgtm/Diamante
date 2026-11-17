import 'dotenv/config';
import { supabaseAdmin } from './auth.service';
// PATH: server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './auth.routes';
import warroomRouter from './warroom.routes';
import crmRouter from './crm.routes';
import storeRouter from './store.routes';
import financeRouter from './finance.routes';
import settingsRouter from './settings.routes';
import clientsRouter from './clients.routes';
import collaborationRouter from './collaboration.routes';
import tasksRouter from './tasks.routes';
import goalsRouter from './goals.routes';
import opportunitiesRouter from './opportunities.routes';
import expansionSitesRouter from './expansion-sites.routes';


import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { isSocketTokenActive } from './socket-session';
import { verifyAdmin } from './middleware/verifyAdmin';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';
import { sendWhatsAppBirthdayGreeting } from './whatsapp.service';
import { requiresSecondPurchaseApproval } from './store-purchase-validation';
import { authorizePurchase } from './purchase-approval';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const cliPort = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : null;
const PORT = cliPort || parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// =========================================================================
// 1. CONFIGURAÇÃO DE SEGURANÇA CORS
// =========================================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  `http://localhost:${PORT}`,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não autorizada por CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =========================================================================
// 2. PROTEÇÃO BÁSICA CONTRA BRUTE-FORCE
// =========================================================================
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
let rateLimitCleanupCounter = 0;

function bruteForceProtection(req: Request, res: Response, next: NextFunction): void {
  // Os routers de autenticação também estão montados em /admin e /api/admin.
  // Aplicar o limite por IP em todos os aliases dos mesmos endpoints sensíveis.
  const isSensitiveAuthEndpoint =
    /^\/(?:auth|api\/auth|admin|api\/admin)\/(?:request-otp|send-otp|verify-otp|login|register|session)\/?$/.test(req.path);

  if (!isSensitiveAuthEndpoint) {
    return next();
  }

  // Nunca confiar em X-Forwarded-For fornecido pelo cliente.
  const remoteAddress = req.socket.remoteAddress;

  if (typeof remoteAddress !== 'string' || !remoteAddress.trim()) {
    res.status(503).json({
      success: false,
      message: 'Não foi possível validar a origem do pedido.',
    });
    return;
  }

  const clientIp = remoteAddress.trim().toLowerCase().replace(/^::ffff:/, '');
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 30;

  // Limpeza periódica dos registos expirados, sem timers adicionais.
  rateLimitCleanupCounter += 1;

  if (rateLimitCleanupCounter >= 256) {
    rateLimitCleanupCounter = 0;

    for (const [ip, record] of rateLimitMap) {
      if (now > record.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  }

  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
    return next();
  }

  record.count += 1;

  if (record.count > maxAttempts) {
    res.status(429).json({
      success: false,
      message: 'Demasiadas tentativas de autenticação. Por favor, aguarde alguns instantes antes de tentar novamente.',
    });
    return;
  }

  return next();
}

app.use(bruteForceProtection);

// =========================================================================
// 3. ENDPOINTS DA API & ROTAS DE AUTENTICAÇÃO
// =========================================================================
// Suporte duplo (/auth/* e /api/auth/*) para máxima compatibilidade com frontend e clientes externos
app.use('/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/api/v1/admin/dashboard', warroomRouter);
app.use('/api/admin/crm', crmRouter);
app.use('/api/admin/finance', financeRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/store', storeRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/collaboration', collaborationRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/admin/opportunities', opportunitiesRouter);
app.use('/api/admin/expansion-sites', expansionSitesRouter);

// Perfil da loja associada à sessão: nunca aceitar loja_id enviado pelo cliente.
app.get('/api/store/profile', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  if (!employee?.ativo || !employee.loja_id) {
    return res.status(403).json({ success: false, message: 'A conta não está associada a uma loja ativa.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('lojas')
      .select('id, nome, codigo_loja, morada, telefone, latitude, longitude, ativo')
      .eq('id', employee.loja_id)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      console.error('[STORE] Falha ao consultar perfil da loja.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar os dados da loja.' });
    }
    if (!data) {
      return res.status(404).json({ success: false, message: 'Loja não encontrada ou inativa.' });
    }
    return res.json({ success: true, loja: data });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar a loja.' });
  }
});

// O funcionário activo só pode encaminhar artigos que pertencem à sua própria loja.
app.post('/api/store/inventory/:id/dispatch', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const employee = req.authenticatedUser;
  const itemId = req.params.id;
  if (!employee?.ativo || !employee.loja_id) {
    return res.status(403).json({ success: false, message: 'A conta não está associada a uma loja ativa.' });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    return res.status(400).json({ success: false, message: 'Identificador de artigo inválido.' });
  }

  try {
    const { data: item, error: readError } = await supabaseAdmin
      .from('inventario_fisico')
      .select('id, estado, loja_atual_id')
      .eq('id', itemId)
      .eq('loja_atual_id', employee.loja_id)
      .maybeSingle();

    if (readError) {
      console.error('[STORE] Falha ao validar artigo para expedição.');
      return res.status(503).json({ success: false, message: 'Não foi possível validar o artigo.' });
    }
    if (!item) {
      return res.status(404).json({ success: false, message: 'Artigo não encontrado nesta loja.' });
    }
    if (item.estado !== 'em_loja') {
      return res.status(409).json({ success: false, message: 'O artigo já não está disponível para expedição.' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('inventario_fisico')
      .update({ estado: 'enviado_sede', data_saida: new Date().toISOString() })
      .eq('id', itemId)
      .eq('loja_atual_id', employee.loja_id)
      .eq('estado', 'em_loja')
      .select('id, estado')
      .maybeSingle();

    if (updateError) {
      console.error('[STORE] Falha ao registar expedição de artigo.');
      return res.status(503).json({ success: false, message: 'Não foi possível registar a expedição.' });
    }
    if (!updated) {
      return res.status(409).json({ success: false, message: 'O estado do artigo foi alterado. Atualize o inventário.' });
    }
    return res.json({ success: true, item: updated });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao registar a expedição.' });
  }
});

// ENDPOINT: LISTAR TRANSAÇÕES PENDENTES PARA AUTORIZAÇÃO
app.get('/api/v1/admin/dashboard/pending', verifyAdmin, async (req, res) => {
  
  try {
    const { data, error } = await supabaseAdmin
      .from('transacoes')
      .select('id, loja_id, valor_final, peso_gramas, estado, created_at, cliente_nome')
      .eq('estado', 'pendente_aprovacao')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    res.json({ success: true, data: data || [] });
  } catch {
    console.error('[Pending Error] Falha ao consultar transações pendentes.');
    res.status(500).json({ success: false, error: 'Não foi possível consultar as transações pendentes.' });
  }
});

// ENDPOINT: AUTORIZAR TRANSAÇÃO PENDENTE
app.post('/api/v1/admin/dashboard/authorize', verifyAdmin, async (req, res) => {
  const transactionId = typeof req.body?.transactionId === 'string' ? req.body.transactionId.trim() : '';
  if (!transactionId) {
    return res.status(400).json({ success: false, error: 'ID da transação obrigatório' });
  }

  const adminId = (req as any).adminUser?.id;
  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Sessão administrativa inválida' });
  }

  try {
    const result = await authorizePurchase({
      transactionId,
      adminId,
      repository: {
        async getTransaction(id) {
          const { data, error } = await supabaseAdmin.from('transacoes')
            .select('id, loja_id, estado, valor_final, primeira_aprovacao_por')
            .eq('id', id)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        async getSettings() {
          const { data, error } = await supabaseAdmin.from('configuracoes_sistema')
            .select('valor')
            .eq('chave', 'parametros_compra_ouro')
            .maybeSingle();
          if (error) throw error;
          return data?.valor?.tetos ?? null;
        },
        async recordFirstApproval(id, approvingAdminId, at) {
          const { data, error } = await supabaseAdmin.from('transacoes')
            .update({ primeira_aprovacao_por: approvingAdminId, data_primeira_aprovacao: at })
            .eq('id', id)
            .eq('estado', 'pendente_aprovacao')
            .is('primeira_aprovacao_por', null)
            .select('id')
            .maybeSingle();
          if (error) throw error;
          return Boolean(data);
        },
        async approve(id, approvingAdminId, at, requireDifferentAdmin) {
          let query = supabaseAdmin.from('transacoes')
            .update({ estado: 'aprovado', aprovado_por: approvingAdminId, data_aprovacao: at })
            .eq('id', id)
            .eq('estado', 'pendente_aprovacao');
          if (requireDifferentAdmin) query = query.neq('primeira_aprovacao_por', approvingAdminId);
          const { data, error } = await query.select('id, loja_id').maybeSingle();
          if (error) throw error;
          return data;
        },
      },
    });

    if (result.status !== 200) return res.status(result.status).json(result.body);

    if ('approved' in result) {
      const approved = result.approved;
      const io = (globalThis as any).io;
      if (io) {
        const event = { id: approved.id, loja_id: approved.loja_id, estado: 'aprovado', approved_at: result.approvedAt };
        io.to('admin').emit('transaction:approved', event);
        if (approved.loja_id) io.to('store:' + approved.loja_id).emit('transaction:approved', event);
      }
    }
    return res.status(200).json(result.body);
  } catch {
    console.error('[Authorize Error] Falha interna ao autorizar compra.');
    return res.status(500).json({ success: false, error: 'Não foi possível autorizar a compra.' });
  }
});

;
app.use('/admin', authRouter);
app.use('/api/admin', authRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    system: 'Diamante OS v2',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    system: 'Diamante OS v2',
    timestamp: new Date().toISOString(),
  });
});

// LISTAGEM ADMINISTRATIVA DE TRANSACOES — APENAS LEITURA
app.get('/api/admin/transactions', verifyAdmin, async (req, res) => {
  const parsedLimit = Number(req.query.limit);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 200) : 100;

  try {
    const { supabaseAdmin } = await import('./auth.service');
    const [transactionsRes, storesRes] = await Promise.all([
      supabaseAdmin
        .from('transacoes')
        .select('id, loja_id, estado, valor_final, peso_gramas, created_at, primeira_aprovacao_por, data_primeira_aprovacao', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin.from('lojas').select('id, nome'),
    ]);

    if (transactionsRes.error || storesRes.error) {
      console.error('[Admin Transactions] Falha numa consulta administrativa.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar as transações.' });
    }

    const storeNames = new Map((storesRes.data || []).map((store: { id: string; nome: string }) => [store.id, store.nome]));
    const data = (transactionsRes.data || []).map((tx: any) => ({
      ...tx,
      loja_nome: storeNames.get(tx.loja_id) || null,
    }));

    return res.json({ success: true, data, total: transactionsRes.count || 0 });
  } catch {
    console.error('[Admin Transactions] Erro interno.');
    return res.status(500).json({ success: false, error: 'Não foi possível carregar as transações.' });
  }
});

// RECEPÇÃO DE OURO NA SEDE — LISTAGEM DE PEÇAS EXPEDIDAS
app.get('/api/admin/inventory/receiving', verifyAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventario_fisico')
      .select('id, codigo_unico, loja_atual_id, transacao_origem_id, tipo_peca, metal, peso_gramas, estado, data_saida')
      .eq('estado', 'enviado_sede')
      .order('data_saida', { ascending: true })
      .limit(500);

    if (error) {
      console.error('[Admin Receiving] Falha ao consultar peças expedidas.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar as peças por receber.' });
    }

    const storeIds = [...new Set((data || []).map((item: any) => item.loja_atual_id).filter(Boolean))];
    const { data: stores, error: storesError } = storeIds.length
      ? await supabaseAdmin.from('lojas').select('id, nome').in('id', storeIds)
      : { data: [], error: null };

    if (storesError) {
      console.error('[Admin Receiving] Falha ao consultar lojas de origem.');
      return res.status(503).json({ success: false, error: 'Não foi possível identificar as lojas de origem.' });
    }

    const storeNames = new Map((stores || []).map((store: any) => [store.id, store.nome]));
    return res.json({
      success: true,
      data: (data || []).map((item: any) => ({ ...item, loja_origem_nome: storeNames.get(item.loja_atual_id) || 'Loja não identificada' })),
    });
  } catch {
    console.error('[Admin Receiving] Erro interno.');
    return res.status(500).json({ success: false, error: 'Erro interno ao carregar a recepção.' });
  }
});

// HISTÓRICO AUDITÁVEL DOS MOVIMENTOS FÍSICOS DE OURO
app.get('/api/admin/inventory/movements', verifyAdmin, async (req, res) => {
  const requestedLimit = Number(req.query.limit || 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100;
  const inventoryId = typeof req.query.inventario_id === 'string' ? req.query.inventario_id.trim() : '';

  if (inventoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inventoryId)) {
    return res.status(400).json({ success: false, error: 'Identificador de inventário inválido.' });
  }

  try {
    let query = supabaseAdmin
      .from('ouro_movimentos_fisicos')
      .select('id, inventario_id, evento, estado_anterior, estado_novo, loja_id, peso_declarado_gramas, peso_recebido_gramas, diferenca_peso_gramas, operador_id, ocorrido_em, observacoes, lote_fundicao_id')
      .order('ocorrido_em', { ascending: false })
      .limit(limit);
    if (inventoryId) query = query.eq('inventario_id', inventoryId);

    const { data, error } = await query;
    if (error) {
      console.error('[Admin Inventory Movements] Falha ao consultar histórico.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar o histórico de movimentos.' });
    }

    const inventoryIds = [...new Set((data || []).map((event: any) => event.inventario_id))];
    const storeIds = [...new Set((data || []).map((event: any) => event.loja_id).filter(Boolean))];
    const batchIds = [...new Set((data || []).map((event: any) => event.lote_fundicao_id).filter(Boolean))];
    const [inventoryResult, storesResult, batchesResult] = await Promise.all([
      inventoryIds.length
        ? supabaseAdmin.from('inventario_fisico').select('id, codigo_unico, metal, tipo_peca').in('id', inventoryIds)
        : Promise.resolve({ data: [], error: null }),
      storeIds.length
        ? supabaseAdmin.from('lojas').select('id, nome').in('id', storeIds)
        : Promise.resolve({ data: [], error: null }),
      batchIds.length
        ? supabaseAdmin.from('ouro_fundicao_lotes').select('id, codigo_lote').in('id', batchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (inventoryResult.error || storesResult.error || batchesResult.error) {
      console.error('[Admin Inventory Movements] Falha ao enriquecer histórico.');
      return res.status(503).json({ success: false, error: 'Não foi possível identificar peças ou lojas do histórico.' });
    }

    const inventoryById = new Map((inventoryResult.data || []).map((item: any) => [item.id, item]));
    const storeById = new Map((storesResult.data || []).map((store: any) => [store.id, store.nome]));
    const batchById = new Map((batchesResult.data || []).map((batch: any) => [batch.id, batch.codigo_lote]));
    return res.json({
      success: true,
      data: (data || []).map((event: any) => ({
        ...event,
        codigo_peca: inventoryById.get(event.inventario_id)?.codigo_unico || 'Peça não identificada',
        metal: inventoryById.get(event.inventario_id)?.metal || null,
        tipo_peca: inventoryById.get(event.inventario_id)?.tipo_peca || null,
        loja_nome: storeById.get(event.loja_id) || null,
        codigo_lote_fundicao: batchById.get(event.lote_fundicao_id) || null,
        divergencia: event.diferenca_peso_gramas != null && Math.abs(Number(event.diferenca_peso_gramas)) > 0.05,
      })),
    });
  } catch {
    console.error('[Admin Inventory Movements] Erro interno.');
    return res.status(500).json({ success: false, error: 'Erro interno ao carregar o histórico.' });
  }
});

// RECEPÇÃO DE OURO NA SEDE — CONFIRMAÇÃO ATÓMICA POR ADMINISTRADOR
app.post('/api/admin/inventory/:id/receive', verifyAdmin, async (req, res) => {
  const itemId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const adminId = (req as any).adminUser?.id;
  const rawReceivedWeight = Number(req.body?.peso_recebido_gramas);
  const receivedWeight = Number.isFinite(rawReceivedWeight) ? Number(rawReceivedWeight.toFixed(3)) : Number.NaN;
  const note = typeof req.body?.observacoes_rececao === 'string' ? req.body.observacoes_rececao.trim().slice(0, 1000) : '';

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    return res.status(400).json({ success: false, error: 'Identificador de peça inválido.' });
  }
  if (!adminId || !Number.isFinite(receivedWeight) || receivedWeight <= 0 || receivedWeight > 100000) {
    return res.status(400).json({ success: false, error: 'Indique um peso recebido válido em gramas.' });
  }

  try {
    const { data: current, error: readError } = await supabaseAdmin
      .from('inventario_fisico')
      .select('id, codigo_unico, peso_gramas, estado')
      .eq('id', itemId)
      .eq('estado', 'enviado_sede')
      .maybeSingle();

    if (readError) {
      console.error('[Admin Receiving] Falha ao consultar peça para recepção.');
      return res.status(503).json({ success: false, error: 'Não foi possível validar a peça.' });
    }
    if (!current) {
      return res.status(409).json({ success: false, error: 'A peça já foi recebida ou não está marcada como enviada.' });
    }

    const declaredWeight = Number(current.peso_gramas);
    const difference = Number((receivedWeight - declaredWeight).toFixed(3));
    if (Math.abs(difference) > 0.05 && note.length < 8) {
      return res.status(422).json({ success: false, error: 'A diferença de peso excede 0,05 g. Registe uma observação com pelo menos 8 caracteres.' });
    }

    const { data, error } = await supabaseAdmin
      .from('inventario_fisico')
      .update({
        estado: 'recebido_sede',
        peso_recebido_gramas: receivedWeight,
        diferenca_peso_gramas: difference,
        recebido_por: adminId,
        data_rececao: new Date().toISOString(),
        observacoes_rececao: note || null,
      })
      .eq('id', itemId)
      .eq('estado', 'enviado_sede')
      .select('id, codigo_unico, estado, peso_gramas, peso_recebido_gramas, diferenca_peso_gramas, recebido_por, data_rececao, observacoes_rececao')
      .maybeSingle();

    if (error) {
      console.error('[Admin Receiving] Falha ao registar recepção.');
      return res.status(503).json({ success: false, error: 'Não foi possível guardar a recepção.' });
    }
    if (!data) {
      return res.status(409).json({ success: false, error: 'A peça foi alterada por outro operador. Actualize a lista.' });
    }

    const io = (globalThis as any).io;
    if (io) io.to('admin').emit('inventory:received', data);
    return res.json({ success: true, item: data });
  } catch {
    console.error('[Admin Receiving] Erro interno ao registar recepção.');
    return res.status(500).json({ success: false, error: 'Erro interno ao registar a recepção.' });
  }
});

// LOTES DE FUNDICAO — API ADMINISTRATIVA
app.get('/api/admin/refining/eligible', verifyAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventario_fisico')
      .select('id, codigo_unico, metal, tipo_peca, peso_gramas, peso_recebido_gramas, diferenca_peso_gramas, transacao_origem_id, data_rececao')
      .eq('estado', 'recebido_sede')
      .ilike('metal', 'Ouro%')
      .order('data_rececao', { ascending: true })
      .limit(500);
    if (error) {
      console.error('[Refining] Falha ao carregar peças elegíveis.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar as peças recebidas.' });
    }
    return res.json({ success: true, data: data || [] });
  } catch {
    return res.status(500).json({ success: false, error: 'Erro interno ao carregar peças para fundição.' });
  }
});

app.get('/api/admin/refining/batches', verifyAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ouro_fundicao_lotes')
      .select('id, codigo_lote, estado, quantidade_pecas, peso_entrada_gramas, custo_aquisicao_total, peso_recuperado_gramas, toque_milesimos, ouro_fino_recuperado_gramas, perda_processo_gramas, rendimento_percentagem, criado_em, concluido_em, observacoes')
      .order('criado_em', { ascending: false })
      .limit(200);
    if (error) {
      console.error('[Refining] Falha ao carregar lotes.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar os lotes de fundição.' });
    }
    const batchIds = (data || []).map((batch: any) => batch.id);
    const { data: settlements, error: settlementsError } = batchIds.length
      ? await supabaseAdmin.from('ouro_fundicao_liquidacoes')
          .select('id, lote_id, ouro_fino_vendido_gramas, preco_por_grama, receita_bruta, custo_lote_alocado, custos_adicionais, resultado_liquido, comprador, referencia_documento, liquidado_em')
          .in('lote_id', batchIds)
          .order('liquidado_em', { ascending: false })
      : { data: [], error: null };
    if (settlementsError) {
      console.error('[Refining] Falha ao carregar liquidações.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar as liquidações dos lotes.' });
    }
    const settlementsByBatch = new Map<string, any[]>();
    for (const settlement of settlements || []) {
      const current = settlementsByBatch.get(settlement.lote_id) || [];
      current.push(settlement);
      settlementsByBatch.set(settlement.lote_id, current);
    }
    const { data: pieces, error: piecesError } = batchIds.length
      ? await supabaseAdmin
          .from('ouro_fundicao_lote_pecas')
          .select('lote_id, inventario_id, transacao_origem_id, codigo_peca, peso_recebido_gramas, custo_aquisicao')
          .in('lote_id', batchIds)
      : { data: [], error: null };
    if (piecesError) {
      console.error('[Refining] Falha ao carregar peças dos lotes.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar a rastreabilidade das peças.' });
    }
    const inventoryIds = [...new Set((pieces || []).map((piece: any) => piece.inventario_id))];
    const { data: sourceInventory, error: sourceInventoryError } = inventoryIds.length
      ? await supabaseAdmin.from('inventario_fisico')
          .select('id, peso_gramas, peso_recebido_gramas, diferenca_peso_gramas')
          .in('id', inventoryIds)
      : { data: [], error: null };
    if (sourceInventoryError) {
      console.error('[Refining] Falha ao reconciliar pesos de origem.');
      return res.status(503).json({ success: false, error: 'Não foi possível reconciliar os pesos de origem e recepção.' });
    }
    const sourceInventoryById = new Map((sourceInventory || []).map((item: any) => [item.id, item]));
    const { data: operationalCosts, error: costsError } = batchIds.length
      ? await supabaseAdmin.from('ouro_fundicao_custos')
          .select('lote_id, categoria, descricao, valor, criado_em')
          .in('lote_id', batchIds)
      : { data: [], error: null };
    if (costsError) {
      console.error('[Refining] Falha ao carregar custos operacionais.');
      return res.status(503).json({ success: false, error: 'Não foi possível carregar os custos operacionais.' });
    }
    const costsByBatch = new Map<string, any[]>();
    for (const cost of operationalCosts || []) {
      const current = costsByBatch.get(cost.lote_id) || [];
      current.push(cost);
      costsByBatch.set(cost.lote_id, current);
    }
    const piecesByBatch = new Map<string, any[]>();
    for (const piece of pieces || []) {
      const current = piecesByBatch.get(piece.lote_id) || [];
      current.push(piece);
      piecesByBatch.set(piece.lote_id, current);
    }
    return res.json({
      success: true,
      data: (data || []).map((batch: any) => {
        const fineGold = Number(batch.ouro_fino_recuperado_gramas || 0);
        const acquisitionCost = Number(batch.custo_aquisicao_total || 0);
        const costs = costsByBatch.get(batch.id) || [];
        const operationalCost = costs.reduce((sum: number, cost: any) => sum + Number(cost.valor || 0), 0);
        const totalCost = acquisitionCost + operationalCost;
        const batchPieces = piecesByBatch.get(batch.id) || [];
        const sourceWeights = batchPieces.map((piece: any) => sourceInventoryById.get(piece.inventario_id)).filter(Boolean) as any[];
        const declaredWeight = sourceWeights.reduce((sum: number, item: any) => sum + Number(item.peso_gramas || 0), 0);
        const receivedWeight = batchPieces.reduce((sum: number, piece: any) => sum + Number(piece.peso_recebido_gramas || 0), 0);
        const sourceWeightComplete = sourceWeights.length === batchPieces.length && batchPieces.length === Number(batch.quantidade_pecas);
        const transportDifference = sourceWeightComplete ? Number((receivedWeight - declaredWeight).toFixed(3)) : null;
        const batchEntryDifference = Number((Number(batch.peso_entrada_gramas || 0) - receivedWeight).toFixed(3));
        const transportAlert = transportDifference !== null && Math.abs(transportDifference) > 0.05;
        const batchEntryAlert = Math.abs(batchEntryDifference) > 0.005;
        return {
          ...batch,
          reconciliacao_pesos: {
            peso_declarado_loja_gramas: sourceWeightComplete ? Number(declaredWeight.toFixed(3)) : null,
            peso_recebido_sede_gramas: Number(receivedWeight.toFixed(3)),
            diferenca_transporte_gramas: transportDifference,
            peso_entrada_lote_gramas: Number(Number(batch.peso_entrada_gramas).toFixed(3)),
            diferenca_entrada_lote_gramas: batchEntryDifference,
            perda_fundicao_gramas: batch.estado === 'concluido' ? Number(batch.perda_processo_gramas || 0) : null,
            ouro_fino_recuperado_gramas: batch.estado === 'concluido' ? Number(fineGold.toFixed(3)) : null,
            origem_completa: sourceWeightComplete,
            alerta_transporte: transportAlert,
            alerta_entrada_lote: batchEntryAlert,
            estado: !sourceWeightComplete ? 'dados_incompletos' : (transportAlert || batchEntryAlert ? 'divergencia' : 'reconciliado'),
          },
          custo_operacional_total: Number(operationalCost.toFixed(2)),
          custo_total: Number(totalCost.toFixed(2)),
          custo_por_grama_fino: batch.estado === 'concluido' && fineGold > 0
            ? Number((totalCost / fineGold).toFixed(4))
            : null,
          custos_operacionais: costs,
          liquidacoes: settlementsByBatch.get(batch.id) || [],
          ouro_fino_vendido_gramas: Number((settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.ouro_fino_vendido_gramas || 0), 0).toFixed(3)),
          ouro_fino_disponivel_gramas: Number(Math.max(0, fineGold - (settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.ouro_fino_vendido_gramas || 0), 0)).toFixed(3)),
          receita_realizada: Number((settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.receita_bruta || 0), 0).toFixed(2)),
          resultado_realizado: Number((settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.resultado_liquido || 0), 0).toFixed(2)),
          custo_ainda_por_recuperar: Number(Math.max(0, totalCost - (settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.custo_lote_alocado || 0), 0)).toFixed(2)),
          preco_medio_realizado_grama: (settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.ouro_fino_vendido_gramas || 0), 0) > 0
            ? Number(((settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.receita_bruta || 0), 0) / (settlementsByBatch.get(batch.id) || []).reduce((sum: number, sale: any) => sum + Number(sale.ouro_fino_vendido_gramas || 0), 0)).toFixed(4))
            : null,
          pecas: piecesByBatch.get(batch.id) || [],
        };
      }),
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Erro interno ao carregar lotes.' });
  }
});

app.post('/api/admin/refining/batches', verifyAdmin, async (req, res) => {
  const adminId = (req as any).adminUser?.id;
  const ids = req.body?.inventario_ids;
  const note = typeof req.body?.observacoes === 'string' ? req.body.observacoes.trim().slice(0, 1000) : null;
  if (!adminId || !Array.isArray(ids) || ids.length < 1 || ids.length > 500 ||
      ids.some((id: unknown) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) ||
      new Set(ids).size !== ids.length) {
    return res.status(400).json({ success: false, error: 'Seleccione peças válidas e sem duplicados.' });
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('criar_lote_ouro_fundicao', {
      p_inventario_ids: ids,
      p_admin_id: adminId,
      p_observacoes: note,
    });
    if (error) {
      console.error('[Refining] Não foi possível criar o lote.');
      return res.status(409).json({ success: false, error: error.message || 'As peças podem já não estar disponíveis para fundição.' });
    }
    return res.status(201).json({ success: true, lote: data });
  } catch {
    return res.status(500).json({ success: false, error: 'Erro interno ao criar lote.' });
  }
});

app.post('/api/admin/refining/batches/:id/costs', verifyAdmin, async (req, res) => {
  const adminId = (req as any).adminUser?.id;
  const batchId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const category = req.body?.categoria;
  const description = typeof req.body?.descricao === 'string' ? req.body.descricao.trim() : '';
  const amount = Number(typeof req.body?.valor === 'string' ? req.body.valor.replace(',', '.') : req.body?.valor);
  if (!adminId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId) ||
      !['transporte', 'analise', 'fundicao', 'outro'].includes(category) ||
      description.length < 2 || description.length > 300 || !Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    return res.status(400).json({ success: false, error: 'Indique categoria, descrição e valor válidos.' });
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('adicionar_custo_ouro_fundicao', {
      p_lote_id: batchId, p_categoria: category, p_descricao: description,
      p_valor: Number(amount.toFixed(2)), p_admin_id: adminId,
    });
    if (error) return res.status(409).json({ success: false, error: error.message || 'Não foi possível registar o custo.' });
    return res.status(201).json({ success: true, custo: data });
  } catch {
    return res.status(500).json({ success: false, error: 'Erro interno ao registar custo operacional.' });
  }
});

app.post('/api/admin/refining/batches/:id/complete', verifyAdmin, async (req, res) => {
  const adminId = (req as any).adminUser?.id;
  const batchId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const rawWeight = Number(req.body?.peso_recuperado_gramas);
  const rawTouch = Number(req.body?.toque_milesimos);
  const recoveredWeight = Number.isFinite(rawWeight) ? Number(rawWeight.toFixed(3)) : Number.NaN;
  const touch = Number.isFinite(rawTouch) ? Number(rawTouch.toFixed(3)) : Number.NaN;
  const note = typeof req.body?.observacoes === 'string' ? req.body.observacoes.trim().slice(0, 1000) : null;
  if (!adminId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId) ||
      !Number.isFinite(recoveredWeight) || recoveredWeight <= 0 ||
      !Number.isFinite(touch) || touch < 0 || touch > 1000) {
    return res.status(400).json({ success: false, error: 'Indique um lote, peso recuperado e toque válidos.' });
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('concluir_lote_ouro_fundicao', {
      p_lote_id: batchId,
      p_peso_recuperado_gramas: recoveredWeight,
      p_toque_milesimos: touch,
      p_admin_id: adminId,
      p_observacoes: note,
    });
    if (error) {
      console.error('[Refining] Não foi possível concluir o lote.');
      return res.status(409).json({ success: false, error: error.message || 'O lote não pode ser concluído com os valores indicados.' });
    }
    return res.json({ success: true, lote: data });
  } catch {
    return res.status(500).json({ success: false, error: 'Erro interno ao concluir lote.' });
  }
});

// LIQUIDAÇÃO DE OURO REFINADO — REGISTO DE VENDAS REAIS
app.post('/api/admin/refining/batches/:id/settlements', verifyAdmin, async (req, res) => {
  const adminId = (req as any).adminUser?.id;
  const batchId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const grams = Number(typeof req.body?.ouro_fino_vendido_gramas === 'string' ? req.body.ouro_fino_vendido_gramas.replace(',', '.') : req.body?.ouro_fino_vendido_gramas);
  const price = Number(typeof req.body?.preco_por_grama === 'string' ? req.body.preco_por_grama.replace(',', '.') : req.body?.preco_por_grama);
  const extra = Number(typeof req.body?.custos_adicionais === 'string' ? req.body.custos_adicionais.replace(',', '.') : (req.body?.custos_adicionais ?? 0));
  const buyer = typeof req.body?.comprador === 'string' ? req.body.comprador.trim() : '';
  const documentRef = typeof req.body?.referencia_documento === 'string' ? req.body.referencia_documento.trim() : '';
  const idempotencyKey = typeof req.body?.chave_idempotencia === 'string' ? req.body.chave_idempotencia.trim() : '';
  if (!adminId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey) ||
      !Number.isFinite(grams) || grams <= 0 || !Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(extra) || extra < 0 || buyer.length < 2 || buyer.length > 200 || documentRef.length > 200) {
    return res.status(400).json({ success: false, error: 'Indique quantidade, preço, comprador e custos válidos.' });
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('registar_liquidacao_ouro_fundicao', {
      p_lote_id: batchId, p_chave_idempotencia: idempotencyKey,
      p_ouro_fino_vendido_gramas: Number(grams.toFixed(3)),
      p_preco_por_grama: Number(price.toFixed(6)),
      p_custos_adicionais: Number(extra.toFixed(2)),
      p_comprador: buyer, p_referencia_documento: documentRef || null,
      p_admin_id: adminId,
    });
    if (error) {
      console.error('[Refining Settlement] Não foi possível registar liquidação.');
      return res.status(409).json({ success: false, error: error.message || 'A liquidação não pode ser registada.' });
    }
    return res.status(201).json({ success: true, liquidacao: data });
  } catch {
    return res.status(500).json({ success: false, error: 'Erro interno ao registar liquidação.' });
  }
});

// RENTABILIDADE DE OURO — AGREGAÇÃO POR LOJA DE ORIGEM E PERÍODO DE LIQUIDAÇÃO
app.get('/api/admin/refining/profitability', verifyAdmin, async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) {
    return res.status(400).json({ success: false, error: 'Período inválido. Utilize datas no formato AAAA-MM-DD.' });
  }
  try {
    const fetchAll = async (table: string, select: string, configure?: (query: any) => any) => {
      const rows: any[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        let query = supabaseAdmin.from(table).select(select).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
        if (configure) query = configure(query);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    };
    const settlements = await fetchAll('ouro_fundicao_liquidacoes',
      'id,lote_id,ouro_fino_vendido_gramas,receita_bruta,custo_lote_alocado,custos_adicionais,resultado_liquido,liquidado_em',
      query => {
        let filtered = query.order('liquidado_em', { ascending: true });
        if (from) filtered = filtered.gte('liquidado_em', from + 'T00:00:00.000Z');
        if (to) filtered = filtered.lt('liquidado_em', new Date(new Date(to + 'T00:00:00Z').getTime() + 86400000).toISOString());
        return filtered;
      });
    if (!settlements.length) return res.json({ success: true, period: { from: from || null, to: to || null }, totals: { revenue: 0, allocated_cost: 0, additional_costs: 0, result: 0, fine_gold_sold_grams: 0 }, stores: [], unmatched: { revenue: 0, allocated_cost: 0, additional_costs: 0, result: 0, fine_gold_sold_grams: 0 } });

    const batchIds = Array.from(new Set(settlements.map((sale: any) => sale.lote_id)));
    const [batches, pieces] = await Promise.all([
      fetchAll('ouro_fundicao_lotes', 'id,custo_aquisicao_total,ouro_fino_recuperado_gramas', q => q.in('id', batchIds)),
      fetchAll('ouro_fundicao_lote_pecas', 'lote_id,transacao_origem_id,custo_aquisicao,peso_recebido_gramas', q => q.in('lote_id', batchIds)),
    ]);
    const transactionIds = Array.from(new Set(pieces.map((piece: any) => piece.transacao_origem_id).filter(Boolean)));
    const transactions = transactionIds.length
      ? await fetchAll('transacoes', 'id,loja_id', q => q.in('id', transactionIds))
      : [];
    const storeIds = Array.from(new Set(transactions.map((tx: any) => tx.loja_id).filter(Boolean)));
    const stores = storeIds.length
      ? await fetchAll('lojas', 'id,nome', q => q.in('id', storeIds))
      : [];
    const batchById = new Map(batches.map((batch: any) => [batch.id, batch]));
    const txById = new Map(transactions.map((tx: any) => [tx.id, tx]));
    const storeNameById = new Map(stores.map((store: any) => [store.id, store.nome]));
    const piecesByBatch = new Map<string, any[]>();
    for (const piece of pieces) {
      const current = piecesByBatch.get(piece.lote_id) || [];
      current.push(piece);
      piecesByBatch.set(piece.lote_id, current);
    }
    const aggregates = new Map<string, any>();
    const totals = { revenue: 0, allocated_cost: 0, additional_costs: 0, result: 0, fine_gold_sold_grams: 0 };
    const unmatched = { revenue: 0, allocated_cost: 0, additional_costs: 0, result: 0, fine_gold_sold_grams: 0 };
    for (const sale of settlements) {
      const batch = batchById.get(sale.lote_id);
      const batchPieces = piecesByBatch.get(sale.lote_id) || [];
      const batchAcquisitionCost = Number(batch?.custo_aquisicao_total || 0);
      const storeAcquisition = new Map<string, number>();
      const storeWeight = new Map<string, number>();
      let knownAcquisition = 0;
      let knownWeight = 0;
      for (const piece of batchPieces) {
        const tx = txById.get(piece.transacao_origem_id);
        const cost = Number(piece.custo_aquisicao || 0);
        if (tx?.loja_id) {
          storeAcquisition.set(tx.loja_id, (storeAcquisition.get(tx.loja_id) || 0) + cost);
          storeWeight.set(tx.loja_id, (storeWeight.get(tx.loja_id) || 0) + Number(piece.peso_recebido_gramas || 0));
          knownAcquisition += cost;
          knownWeight += Number(piece.peso_recebido_gramas || 0);
        }
      }
      const useAcquisitionBasis = batchAcquisitionCost > 0 && knownAcquisition > 0;
      const basisTotal = useAcquisitionBasis ? Math.max(batchAcquisitionCost, knownAcquisition) : knownWeight;
      const saleRevenue = Number(sale.receita_bruta || 0);
      const saleCost = Number(sale.custo_lote_alocado || 0);
      const saleExtra = Number(sale.custos_adicionais || 0);
      const saleResult = Number(sale.resultado_liquido || 0);
      totals.revenue += saleRevenue;
      totals.allocated_cost += saleCost;
      totals.additional_costs += saleExtra;
      totals.result += saleResult;
      totals.fine_gold_sold_grams += Number(sale.ouro_fino_vendido_gramas || 0);
      let allocatedShare = 0;
      const storeIdsForBatch = new Set([...storeAcquisition.keys(), ...storeWeight.keys()]);
      for (const storeId of storeIdsForBatch) {
        const basisValue = useAcquisitionBasis ? (storeAcquisition.get(storeId) || 0) : (storeWeight.get(storeId) || 0);
        const share = basisTotal > 0 ? basisValue / basisTotal : 0;
        if (share <= 0) continue;
        allocatedShare += share;
        const key = storeId;
        const row = aggregates.get(key) || { loja_id: storeId, loja_nome: storeNameById.get(storeId) || 'Loja sem nome', revenue: 0, allocated_cost: 0, additional_costs: 0, result: 0, fine_gold_sold_grams: 0 };
        row.revenue += saleRevenue * share;
        row.allocated_cost += saleCost * share;
        row.additional_costs += saleExtra * share;
        row.result += saleResult * share;
        row.fine_gold_sold_grams += Number(sale.ouro_fino_vendido_gramas || 0) * share;
        aggregates.set(key, row);
      }
      if (allocatedShare < 0.999999) {
        const missing = Math.max(0, 1 - allocatedShare);
        unmatched.revenue += saleRevenue * missing;
        unmatched.allocated_cost += saleCost * missing;
        unmatched.additional_costs += saleExtra * missing;
        unmatched.result += saleResult * missing;
        unmatched.fine_gold_sold_grams += Number(sale.ouro_fino_vendido_gramas || 0) * missing;
      }
    }
    const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));
    const rows = Array.from(aggregates.values()).map(row => ({
      ...row,
      revenue: round(row.revenue), allocated_cost: round(row.allocated_cost),
      additional_costs: round(row.additional_costs), result: round(row.result),
      fine_gold_sold_grams: round(row.fine_gold_sold_grams, 3),
      margin_percent: row.revenue > 0 ? round(row.result / row.revenue * 100, 2) : null,
    })).sort((a, b) => b.result - a.result);
    const roundedTotals = {
      revenue: round(totals.revenue),
      allocated_cost: round(totals.allocated_cost),
      additional_costs: round(totals.additional_costs),
      result: round(totals.result),
      fine_gold_sold_grams: round(totals.fine_gold_sold_grams, 3),
    };
    // Fechar cada diferença de arredondamento na rubrica não reconciliada.
    const sumRows = (key: string) => rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
    const roundedUnmatched = {
      revenue: round(roundedTotals.revenue - sumRows('revenue')),
      allocated_cost: round(roundedTotals.allocated_cost - sumRows('allocated_cost')),
      additional_costs: round(roundedTotals.additional_costs - sumRows('additional_costs')),
      result: round(roundedTotals.result - sumRows('result')),
      fine_gold_sold_grams: round(roundedTotals.fine_gold_sold_grams - sumRows('fine_gold_sold_grams'), 3),
    };
    return res.json({
      success: true,
      period: { from: from || null, to: to || null },
      totals: roundedTotals,
      stores: rows,
      unmatched: roundedUnmatched,
      allocation_basis: 'Proporção do custo de aquisição das peças de cada loja no lote; peso como fallback quando o custo total não está disponível. Diferenças de atribuição e arredondamento ficam não reconciliadas.',
    });
  } catch (error) {
    console.error('[Refining Profitability] Falha ao calcular rentabilidade.');
    return res.status(503).json({ success: false, error: 'Não foi possível calcular a rentabilidade por loja e período.' });
  }
});

// DETALHE DE LOJA — CONSULTA ADMINISTRATIVA PROTEGIDA
app.get('/api/admin/war-room/stores/:id', verifyAdmin, async (req, res) => {
  const lojaId = typeof req.params.id === 'string' ? req.params.id.trim() : '';

  if (!lojaId) {
    return res.status(400).json({
      success: false,
      error: 'ID da loja obrigatório'
    });
  }

  try {
    const { supabaseAdmin } = await import('./auth.service');

    const [transactionsRes, employeesRes, historyKpisRes] = await Promise.all([
      supabaseAdmin
        .from('transacoes')
        .select('id, valor_final, peso_gramas, created_at, estado')
        .eq('loja_id', lojaId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('funcionarios')
        .select('id, nome_completo, email, role, ativo')
        .eq('loja_id', lojaId),
      supabaseAdmin
        .from('kpi_loja_diaria')
        .select('data, total_compras_qtd, total_compras_valor')
        .eq('loja_id', lojaId)
        .order('data', { ascending: false })
        .limit(7)
    ]);

    if (transactionsRes.error || employeesRes.error || historyKpisRes.error) {
      console.error('[War Room Store Details] Falha numa consulta administrativa.');
      return res.status(500).json({
        success: false,
        error: 'Não foi possível carregar os detalhes da loja'
      });
    }

    return res.json({
      success: true,
      transactions: transactionsRes.data || [],
      employees: employeesRes.data || [],
      historyKpis: historyKpisRes.data || []
    });
  } catch (_error: unknown) {
    console.error('[War Room Store Details] Erro interno.');
    return res.status(500).json({
      success: false,
      error: 'Não foi possível carregar os detalhes da loja'
    });
  }
});

// =========================================================================
// 3.1 SALA DE GUERRA (WAR ROOM / ADMIN DASHBOARD)
// Proxy seguro server-side para tabelas Supabase (evita falhas de CORS/Iframe no frontend)
// =========================================================================
app.get(['/api/admin/war-room', '/api/war-room', '/admin/war-room'], verifyAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const todayStartIso = `${todayStr}T00:00:00.000Z`;

  try {
    const { supabaseAdmin } = await import('./auth.service');

    const [
      lojasRes,
      todayTxsRes,
      pendingTxsRes,
      kpiTodayRes,
      kpiYesterdayRes,
      recentTxsRes,
      activeEmployeesRes,
      stockCountRes,
    ] = await Promise.all([
      supabaseAdmin.from('lojas').select('id, nome, codigo_loja, morada, latitude, longitude, ativo').order('nome', { ascending: true }),
      supabaseAdmin.from('transacoes').select('id, loja_id, estado, valor_final, peso_gramas').gte('created_at', todayStartIso),
      supabaseAdmin.from('transacoes').select('id, loja_id, valor_final, peso_gramas, estado').eq('estado', 'pendente_aprovacao'),
      supabaseAdmin.from('kpi_loja_diaria').select('loja_id, total_compras_valor, total_compras_qtd, total_peso_ouro_g, pendentes_aprovacao_qtd').eq('data', todayStr),
      supabaseAdmin.from('kpi_loja_diaria').select('loja_id, total_compras_valor, total_compras_qtd, total_peso_ouro_g, pendentes_aprovacao_qtd').eq('data', yesterdayStr),
      supabaseAdmin.from('transacoes').select('id, loja_id, estado, valor_final, peso_gramas, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('funcionarios').select('id', { count: 'exact', head: true }).eq('ativo', true).eq('role', 'funcionario'),
      supabaseAdmin.from('inventario_fisico').select('id', { count: 'exact', head: true }).eq('estado', 'em_loja'),
    ]);

    const queryResults = [
      lojasRes,
      todayTxsRes,
      pendingTxsRes,
      kpiTodayRes,
      kpiYesterdayRes,
      recentTxsRes,
      activeEmployeesRes,
      stockCountRes,
    ];

    if (queryResults.some((result) => result.error)) {
      console.error('[War Room] Uma ou mais consultas administrativas falharam.');
      return res.status(503).json({
        success: false,
        error: 'Não foi possível carregar todos os dados da Sala de Guerra.',
      });
    }

    return res.status(200).json({
      success: true,
      isConnected: true,
      lojas: lojasRes.data || [],
      todayTxs: todayTxsRes.data || [],
      allPendingTxs: pendingTxsRes.data || [],
      kpiToday: kpiTodayRes.data || [],
      kpiYesterday: kpiYesterdayRes.data || [],
      recentTxs: recentTxsRes.data || [],
      recentTxsCount: recentTxsRes.count || 0,
      activeEmployees: activeEmployeesRes.count || 0,
      stockItemsInStores: stockCountRes.count || 0,
    });
  } catch (_err: unknown) {
    console.error('[War Room] Erro interno ao carregar dados administrativos.');
    return res.status(503).json({
      success: false,
      error: 'Serviço da Sala de Guerra temporariamente indisponível.',
    });
  }
});

// =========================================================================
// 4. INTEGRAÇÃO VITE (DESENVOLVIMENTO) E FICHEIROS ESTÁTICOS (PRODUÇÃO)
// =========================================================================
let viteMiddlewares: any = null;

// Delegação para os middlewares do Vite assim que prontos
app.use((req, res, next) => {
  if (viteMiddlewares) {
    return viteMiddlewares(req, res, next);
  }
  next();
});

// [CÓDIGO ÓRFÃO REMOVIDO - Substituído por httpServer.listen abaixo]


// ==========================================
// SERVIDOR HTTP + WEBSOCKET PARA CHAT DIAMANTE OS
// ==========================================
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Lógica de Chat em Tempo Real
io.use(async (socket, next) => {
  try {
    const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    const header = socket.handshake.headers.authorization || '';
    const token = authToken || (header.startsWith('Bearer ') ? header.slice(7).trim() : '');
    const secret = process.env.JWT_SECRET;
    if (!secret || !token) return next(new Error('Autenticação obrigatória.'));
    const claims = jwt.verify(token, secret) as jwt.JwtPayload;
    const tokenExpiresAt = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
    if (!isSocketTokenActive(tokenExpiresAt)) {
      return next(new Error('Sessão inválida ou expirada.'));
    }
    const userId = typeof claims.id === 'string' ? claims.id : '';
    if (!userId) return next(new Error('Sessão inválida.'));
    const { data: employee, error } = await supabaseAdmin.from('funcionarios')
      .select('id, role, loja_id, ativo').eq('id', userId).eq('ativo', true).maybeSingle();
    if (error || !employee) return next(new Error('Utilizador inativo ou não autorizado.'));
    socket.data.employee = employee;
    socket.data.tokenExpiresAt = tokenExpiresAt;
    next();
  } catch {
    next(new Error('Sessão inválida ou expirada.'));
  }
});

const onlineEmployeeConnections = new Map<string, number>();

io.on('connection', (socket) => {
  console.log('[Realtime] Ligação autenticada estabelecida.');
  const connectedEmployee = socket.data.employee as { id: string };
  const connectedEmployeeId = connectedEmployee.id;
  const nextConnectionCount = (onlineEmployeeConnections.get(connectedEmployeeId) || 0) + 1;
  onlineEmployeeConnections.set(connectedEmployeeId, nextConnectionCount);
  let presencePeers: string[] = [];
  void (async () => {
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('collab_conversation_members').select('conversation_id')
      .eq('funcionario_id', connectedEmployeeId);
    if (membershipError || !memberships?.length) return;
    const conversationIds = [...new Set(memberships.map((item: any) => item.conversation_id))];
    const { data: members, error: peersError } = await supabaseAdmin
      .from('collab_conversation_members').select('funcionario_id')
      .in('conversation_id', conversationIds);
    if (peersError) return;
    presencePeers = [...new Set((members || []).map((item: any) => item.funcionario_id)
      .filter((id: string) => id && id !== connectedEmployeeId))];
    const onlinePeers = presencePeers.filter((id) => (onlineEmployeeConnections.get(id) || 0) > 0);
    socket.emit('collab:presence_snapshot', { online: onlinePeers });
    for (const peerId of presencePeers) {
      io.to(peerId).emit('collab:presence', { employeeId: connectedEmployeeId, online: true });
    }
  })().catch(() => console.warn('[Realtime] Não foi possível sincronizar presença da equipa.'));

  const refreshSocketEmployee = async (): Promise<boolean> => {
    const tokenExpiresAt = socket.data.tokenExpiresAt;
    if (!isSocketTokenActive(tokenExpiresAt)) {
      return false;
    }

    const current = socket.data.employee as { id: string } | undefined;
    if (!current?.id) return false;

    const { data: employee, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, role, loja_id, ativo')
      .eq('id', current.id)
      .eq('ativo', true)
      .maybeSingle();

    if (error || !employee || employee.ativo !== true ||
        typeof employee.role !== 'string' || !employee.role.trim()) {
      return false;
    }

    socket.data.employee = employee;
    const allowedRooms = new Set([
      employee.id,
      ...(employee.loja_id ? [`store:${employee.loja_id}`] : []),
      ...(employee.role === 'admin' ? ['admin'] : []),
    ]);

    // Remove salas antigas se a loja ou as permissões tiverem sido alteradas.
    for (const room of socket.rooms) {
      if (room !== socket.id && !allowedRooms.has(room)) {
        await socket.leave(room);
      }
    }
    return true;
  };

  // Revalidar antes de processar qualquer evento enviado pelo cliente.
  socket.use((_packet, next) => {
    void refreshSocketEmployee().then((valid) => {
      if (!valid) {
        socket.disconnect(true);
        next(new Error('Sessão revogada ou utilizador não autorizado.'));
        return;
      }
      next();
    }).catch(() => {
      socket.disconnect(true);
      next(new Error('Não foi possível revalidar a sessão.'));
    });
  });

  // Também revoga ligações inativas pouco depois de uma conta ser desativada.
  const permissionRefresh = setInterval(() => {
    void refreshSocketEmployee().then((valid) => {
      if (!valid) socket.disconnect(true);
    }).catch(() => socket.disconnect(true));
  }, 30000);

  socket.on('join_room', async (room: unknown) => {
    const employee = socket.data.employee as { id: string; role: string; loja_id: string | null };
    const allowedRooms = new Set([
      employee.id,
      ...(employee.loja_id ? [`store:${employee.loja_id}`] : []),
      ...(employee.role === 'admin' ? ['admin'] : []),
    ]);

    if (typeof room !== 'string' || room.length > 128 || !allowedRooms.has(room)) {
      socket.emit('room_denied', {
        room: typeof room === 'string' && room.length <= 128 ? room : null,
        reason: 'Sala não autorizada para esta sessão.',
      });
      console.warn('[Realtime] Pedido de entrada numa sala recusado.');
      return;
    }

    try {
      await socket.join(room);
      if (socket.rooms.has(room)) {
        socket.emit('room_joined', { room });
        console.log('[Realtime] Entrada numa sala autorizada.');
      } else {
        socket.emit('room_denied', { room, reason: 'Não foi possível confirmar a entrada na sala.' });
        console.warn('[Realtime] Entrada numa sala não confirmada.');
      }
    } catch {
      socket.emit('room_denied', { room, reason: 'Falha ao entrar na sala.' });
      console.error('[Realtime] Falha ao adicionar ligação a uma sala.');
    }
  });

  socket.on('send_message', (data: any) => {
    const employee = socket.data.employee as { id: string; role: string; loja_id: string | null };
    const allowedRooms = new Set([
      employee.id,
      ...(employee.loja_id ? [`store:${employee.loja_id}`] : []),
      ...(employee.role === 'admin' ? ['admin'] : []),
    ]);
    if (!data || typeof data.room !== 'string' || !allowedRooms.has(data.room)) return;
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000) return;
    io.to(data.room).emit('receive_message', {
      room: data.room, text: data.text.trim(), senderId: employee.id, createdAt: new Date().toISOString(),
    });
  });

  socket.on('disconnect', (reason) => {
    clearInterval(permissionRefresh);
    const remainingConnections = Math.max(0, (onlineEmployeeConnections.get(connectedEmployeeId) || 1) - 1);
    if (remainingConnections === 0) {
      onlineEmployeeConnections.delete(connectedEmployeeId);
      for (const peerId of presencePeers) {
        io.to(peerId).emit('collab:presence', { employeeId: connectedEmployeeId, online: false });
      }
    } else {
      onlineEmployeeConnections.set(connectedEmployeeId, remainingConnections);
    }
    console.log(`[Realtime] Ligação terminada. Motivo: ${reason}.`);
  });
});

// Processamento diário de aniversários (fuso Europe/Lisbon).
// A função SQL reclama os registos com FOR UPDATE SKIP LOCKED e chave única cliente/ano.
let birthdayWorkerRunning = false;
async function processBirthdayWhatsAppQueue(): Promise<void> {
  if (birthdayWorkerRunning) return;
  const lisbonParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const lisbonHour = Number(lisbonParts.find((part) => part.type === 'hour')?.value ?? '0');
  const sendFromHour = Math.max(0, Math.min(23, Number(process.env.BIRTHDAY_WHATSAPP_SEND_FROM_HOUR || 10)));
  const sendUntilHour = Math.max(sendFromHour + 1, Math.min(24, Number(process.env.BIRTHDAY_WHATSAPP_SEND_UNTIL_HOUR || 20)));
  if (!Number.isFinite(lisbonHour) || lisbonHour < sendFromHour || lisbonHour >= sendUntilHour) return;
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_INSTANCE) {
    console.warn('[Birthday WhatsApp] Integração Evolution API não configurada; fila não consumida.');
    return;
  }
  birthdayWorkerRunning = true;
  try {
    const { data: birthdays, error } = await supabaseAdmin.rpc('claim_birthday_whatsapp_messages');
    if (error) {
      console.error('[Birthday WhatsApp] Não foi possível reclamar a fila.');
      return;
    }
    for (const birthday of birthdays || []) {
      const { data: current, error: currentError } = await supabaseAdmin.from('clientes')
        .select('nome,telemovel,data_nascimento,consentimento_whatsapp_aniversario')
        .eq('id', birthday.cliente_id).maybeSingle();
      const lisbonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const stillBirthday = current?.data_nascimento
        ? new Date(current.data_nascimento).getUTCMonth() === new Date(lisbonToday).getUTCMonth()
          && new Date(current.data_nascimento).getUTCDate() === new Date(lisbonToday).getUTCDate()
        : false;
      if (currentError || !current || current.consentimento_whatsapp_aniversario !== true || !stillBirthday) {
        await supabaseAdmin.from('whatsapp_aniversarios_envios')
          .update({ estado: 'ignorado', erro: 'Consentimento retirado ou aniversário já não corresponde à data actual.', atualizado_em: new Date().toISOString() })
          .eq('cliente_id', birthday.cliente_id).eq('ano', birthday.ano).eq('estado', 'em_processamento');
        continue;
      }
      const result = await sendWhatsAppBirthdayGreeting(current.telemovel, current.nome);
      const update = await supabaseAdmin.from('whatsapp_aniversarios_envios')
        .update({
          estado: result.success ? 'enviado' : 'falhado',
          message_id: result.messageId || null,
          erro: result.success ? null : (result.error || 'Falha no envio.'),
          atualizado_em: new Date().toISOString(),
          enviado_em: result.success ? new Date().toISOString() : null,
        })
        .eq('cliente_id', birthday.cliente_id)
        .eq('ano', birthday.ano)
        .eq('estado', 'em_processamento');
      if (update.error) console.error('[Birthday WhatsApp] Falha ao actualizar estado de envio.');
    }
  } catch {
    console.error('[Birthday WhatsApp] Erro inesperado no processamento.');
  } finally {
    birthdayWorkerRunning = false;
  }
}

function startBirthdayWhatsAppWorker(): void {
  // Verifica a fila de 15 em 15 minutos, apenas dentro do horário local configurado (por defeito 10h–20h).
  void processBirthdayWhatsAppQueue();
  setInterval(() => void processBirthdayWhatsAppQueue(), 15 * 60 * 1000);
}

// Tornar io disponível globalmente para outras rotas/middlewares
(globalThis as any).io = io;


// Inicialização assíncrona do Vite em desenvolvimento ou ficheiros estáticos em produção
async function setupViteOrStatic() {
  if (!isProduction) {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      viteMiddlewares = vite.middlewares;
      console.log('[Diamante OS] Vite dev server integrado com sucesso.');
    } catch (err) {
      console.error('[Diamante OS] Falha ao integrar o servidor Vite.');
    }
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
}

// Iniciar servidor HTTP com WebSocket (substitui app.listen tradicional)
setupViteOrStatic().then(() => {
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    startBirthdayWhatsAppWorker();
    console.log(`=========================================`);
    console.log(`💎 DIAMANTE OS v2 - SERVIDOR HTTP + WS ATIVO`);
    console.log(`Porta: ${PORT}`);
    console.log(`Ambiente: ${isProduction ? 'Produção' : 'Desenvolvimento'}`);
    console.log(`WebSocket: Ativo (Socket.IO)`);
    console.log(`=========================================`);
  });
}).catch(() => {
  console.error('[Diamante OS] Falha fatal ao iniciar o servidor.');
  process.exit(1);
});
