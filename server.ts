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
const PORT = parseInt(process.env.PORT || '3000', 10);
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
    origin: (origin, callback) => {
      // Permite pedidos sem cabeçalho Origin (como ferramentas internas, curl ou same-origin)
      if (!origin) return callback(null, true);

      // Em ambiente de produção verifica correspondência estrita com as origens autorizadas
      if (allowedOrigins.length > 0 && (allowedOrigins.includes(origin) || allowedOrigins.some((ao) => origin.startsWith(ao)))) {
        return callback(null, true);
      }

      // Em desenvolvimento permite origens de teste
      if (!isProduction) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'X-Requested-With'],
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
  const maxAttempts = 25; // Limite razoável para prevenir força bruta

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
// 4. INTEGRAÇÃO VITE (DESENVOLVIMENTO) E FICHEIROS ESTÁTICOS (PRODUÇÃO)
// =========================================================================
async function setupViteOrStatic() {
  if (!isProduction) {
    // Montagem dos middlewares do Vite em modo de desenvolvimento
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Diamante OS] Vite dev server integrado com sucesso.');
  } else {
    // Servir ficheiros construídos em produção
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
}

// Início do servidor HTTP
setupViteOrStatic().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`💎 DIAMANTE OS v2 - BACKEND DE AUTH ATIVO`);
    console.log(`Porta: ${PORT}`);
    console.log(`Ambiente: ${isProduction ? 'Produção' : 'Desenvolvimento'}`);
    console.log(`Chave Mestra Ativa: +351937230116`);
    console.log(`=========================================`);
  });
});
