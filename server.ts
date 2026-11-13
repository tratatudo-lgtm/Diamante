import 'dotenv/config';
import { supabaseAdmin } from './auth.service';
// PATH: server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './auth.routes';
import warroomRouter from './warroom.routes';


import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { isSocketTokenActive } from './socket-session';
import { verifyAdmin } from './middleware/verifyAdmin';

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
  const transactionId = req.body?.transactionId;

  if (typeof transactionId !== 'string' || !transactionId.trim()) {
    return res.status(400).json({
      success: false,
      error: 'ID da transação obrigatório'
    });
  }

  try {
    const adminId = (req as any).adminUser?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Sessão administrativa inválida'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('transacoes')
      .update({
        estado: 'aprovado',
        aprovado_por: adminId,
        data_aprovacao: new Date().toISOString()
      })
      .eq('id', transactionId.trim())
      .eq('estado', 'pendente_aprovacao')
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(409).json({
        success: false,
        error: 'A transação não está pendente ou já foi processada'
      });
    }

    console.log('[ADMIN] Transação autorizada com sucesso.');

    return res.json({
      success: true,
      message: 'Transação autorizada com sucesso',
      transactionId: data.id
    });
  } catch {
    console.error('[Authorize Error] Falha interna ao autorizar transação.');

    return res.status(500).json({
      success: false,
      error: 'Não foi possível autorizar a transação'
    });
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
        .select('id, loja_id, estado, valor_final, peso_gramas, created_at', { count: 'exact' })
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
    ] = await Promise.all([
      supabaseAdmin.from('lojas').select('id, nome, codigo_loja, morada, latitude, longitude, ativo').order('nome', { ascending: true }),
      supabaseAdmin.from('transacoes').select('id, loja_id, estado, valor_final, peso_gramas').gte('created_at', todayStartIso),
      supabaseAdmin.from('transacoes').select('id, loja_id, valor_final, peso_gramas, estado').eq('estado', 'pendente_aprovacao'),
      supabaseAdmin.from('kpi_loja_diaria').select('loja_id, total_compras_valor, total_compras_qtd, pendentes_aprovacao_qtd').eq('data', todayStr),
      supabaseAdmin.from('kpi_loja_diaria').select('loja_id, total_compras_valor, total_compras_qtd, pendentes_aprovacao_qtd').eq('data', yesterdayStr),
      supabaseAdmin.from('transacoes').select('id, loja_id, estado, valor_final, peso_gramas, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
    ]);

    const queryResults = [
      lojasRes,
      todayTxsRes,
      pendingTxsRes,
      kpiTodayRes,
      kpiYesterdayRes,
      recentTxsRes,
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

io.on('connection', (socket) => {
  console.log('[Chat WS] Ligação estabelecida.');

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

  socket.on('join_room', (room: unknown) => {
    const employee = socket.data.employee as { id: string; role: string; loja_id: string | null };
    const allowedRooms = new Set([
      employee.id,
      ...(employee.loja_id ? [`store:${employee.loja_id}`] : []),
      ...(employee.role === 'admin' ? ['admin'] : []),
    ]);
    if (typeof room === 'string' && allowedRooms.has(room)) socket.join(room);
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

  socket.on('disconnect', () => {
    clearInterval(permissionRefresh);
    console.log('[Chat WS] Ligação terminada.');
  });
});

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
