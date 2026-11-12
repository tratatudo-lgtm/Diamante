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

function bruteForceProtection(req: Request, res: Response, next: NextFunction): void {
  // Aplicado exclusivamente em endpoints de autenticação sensíveis
  if (!req.path.startsWith('/auth') && !req.path.startsWith('/api/auth')) {
    return next();
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const windowMs = 60 * 1000; // Janela de 1 minuto
  const maxAttempts = 100; // Limite amplo para testes e prevenção de ataques massivos

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
  } catch(e: any) {
    console.error('[Pending Error]:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ENDPOINT: AUTORIZAR TRANSAÇÃO PENDENTE
app.post('/api/v1/admin/dashboard/authorize', verifyAdmin, async (req, res) => {
  
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ error: 'ID da transação obrigatório' });
  
  try {
    const { error } = await supabaseAdmin
      .from('transacoes')
      .update({ 
        estado: 'aprovado', 
        aprovado_por: (req as any).adminUser.id, 
        data_aprovacao: new Date().toISOString() 
      })
      .eq('id', transactionId);
      
    if (error) throw error;
    
    console.log(`[ADMIN] Transação ${transactionId} autorizada por ${(req as any).adminUser.id}`);
    res.json({ success: true, message: 'Transação autorizada com sucesso' });
  } catch(e: any) {
    console.error('[Authorize Error]:', e.message);
    res.status(500).json({ success: false, error: e.message });
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
    const [lojasRes, todayTxsRes, pendingTxsRes, kpiTodayRes, kpiYesterdayRes] = await Promise.allSettled([
      supabaseAdmin.from('lojas').select('*').order('nome', { ascending: true }),
      supabaseAdmin.from('transacoes').select('*').gte('created_at', todayStartIso),
      supabaseAdmin.from('transacoes').select('id, loja_id, valor_final, peso_gramas, estado').eq('estado', 'pendente_aprovacao'),
      supabaseAdmin.from('kpi_loja_diaria').select('*').eq('data', todayStr),
      supabaseAdmin.from('kpi_loja_diaria').select('*').eq('data', yesterdayStr),
    ]);

    const lojas = lojasRes.status === 'fulfilled' && lojasRes.value.data ? lojasRes.value.data : [];
    const todayTxs = todayTxsRes.status === 'fulfilled' && todayTxsRes.value.data ? todayTxsRes.value.data : [];
    const allPendingTxs = pendingTxsRes.status === 'fulfilled' && pendingTxsRes.value.data ? pendingTxsRes.value.data : [];
    const kpiToday = kpiTodayRes.status === 'fulfilled' && kpiTodayRes.value.data ? kpiTodayRes.value.data : [];
    const kpiYesterday = kpiYesterdayRes.status === 'fulfilled' && kpiYesterdayRes.value.data ? kpiYesterdayRes.value.data : [];

    const isConnected = lojasRes.status === 'fulfilled' && !lojasRes.value.error;

    res.status(200).json({
      success: true,
      isConnected,
      lojas,
      todayTxs,
      allPendingTxs,
      kpiToday,
      kpiYesterday,
    });
  } catch (_err: unknown) {
    res.status(200).json({
      success: true,
      isConnected: false,
      lojas: [],
      todayTxs: [],
      allPendingTxs: [],
      kpiToday: [],
      kpiYesterday: [],
      message: 'Base de dados em standby ou aguardar credenciais de produção.',
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
    const userId = typeof claims.id === 'string' ? claims.id : '';
    if (!userId) return next(new Error('Sessão inválida.'));
    const { data: employee, error } = await supabaseAdmin.from('funcionarios')
      .select('id, role, loja_id, ativo').eq('id', userId).eq('ativo', true).maybeSingle();
    if (error || !employee) return next(new Error('Utilizador inativo ou não autorizado.'));
    socket.data.employee = employee;
    next();
  } catch {
    next(new Error('Sessão inválida ou expirada.'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Chat WS] ✅ Conectado: ${socket.id}`);
  
  const employee = socket.data.employee as { id: string; role: string; loja_id: string | null };
  const allowedRooms = new Set([employee.id, ...(employee.loja_id ? [`store:${employee.loja_id}`] : [])]);
  if (employee.role === 'admin') allowedRooms.add('admin');
  socket.on('join_room', (room: unknown) => {
    if (typeof room === 'string' && allowedRooms.has(room)) socket.join(room);
  });
  socket.on('send_message', (data: any) => {
    if (!data || typeof data.room !== 'string' || !allowedRooms.has(data.room)) return;
    if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000) return;
    io.to(data.room).emit('receive_message', {
      room: data.room, text: data.text.trim(), senderId: employee.id, createdAt: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Chat WS] ❌ Desconectado: ${socket.id}`);
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
      console.error('[Diamante OS] Erro ao integrar Vite:', err);
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
}).catch(err => {
  console.error('[Diamante OS] Erro fatal ao iniciar:', err);
  process.exit(1);
});
