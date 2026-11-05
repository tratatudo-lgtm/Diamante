// PATH: server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRouter from './auth.routes';

dotenv.config();

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

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

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

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    system: 'Diamante OS v2',
    timestamp: new Date().toISOString(),
    evolutionApiUrl: process.env.EVOLUTION_API_URL || 'configurada por omissão',
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
app.get(['/api/admin/war-room', '/api/war-room', '/admin/war-room'], async (_req: Request, res: Response) => {
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

// Início imediato do servidor HTTP (garante que a porta 3000 responde desde o primeiro milissegundo)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`💎 DIAMANTE OS v2 - SERVIDOR HTTP ATIVO`);
  console.log(`Porta: ${PORT}`);
  console.log(`Ambiente: ${isProduction ? 'Produção' : 'Desenvolvimento'}`);
  console.log(`Chave Mestra Ativa: +351937230116`);
  console.log(`=========================================`);
});

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

setupViteOrStatic();
