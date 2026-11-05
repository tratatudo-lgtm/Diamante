// PATH: middleware/verifyAdmin.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../auth.service';
import { normalizePortuguesePhone } from '../auth.routes';

const JWT_SECRET = process.env.JWT_SECRET || 'diamante-os-secret-jwt-key-2026';
const MASTER_PHONE = '+351937230116';

export interface AdminRequest extends Request {
  adminUser?: {
    id?: string;
    telemovel: string;
    role: string;
    nome_completo?: string;
  };
}

/**
 * Middleware verifyAdmin
 * Valida se o utilizador atual tem privilégios de Administrador Master (telemóvel +351937230116 ou função is_admin())
 * Executa o log obrigatório a cada operação de escrita: console.log([ADMIN] Ação executada por +351937230116)
 */
export async function verifyAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let candidatePhone: string | null = null;
    let userRole: string | null = null;
    let userId: string | null = null;
    let userName: string | null = null;

    // 1. Extração via cabeçalho Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded) {
          candidatePhone = decoded.telemovel || decoded.phone || null;
          userRole = decoded.role || null;
          userId = decoded.id || null;
          userName = decoded.nome_completo || null;
        }
      } catch (_jwtErr) {
        // Token inválido ou expirado
      }
    }

    // 2. Extração via cabeçalhos específicos da aplicação se token ausente
    if (!candidatePhone) {
      const headerPhone = (req.headers['x-admin-phone'] || req.headers['x-user-phone']) as string;
      if (headerPhone) {
        candidatePhone = headerPhone;
      }
    }

    // 3. Fallback no body em chamadas de administração
    if (!candidatePhone && req.body && (req.body.adminPhone || req.body.operatorPhone)) {
      candidatePhone = req.body.adminPhone || req.body.operatorPhone;
    }

    // Normalização do número de telefone português
    const normalized = candidatePhone ? normalizePortuguesePhone(candidatePhone) : null;

    // 4. Verificação Master User (+351937230116)
    const isMasterUser = normalized === MASTER_PHONE || (normalized && normalized.includes('937230116'));

    let isAuthorized = false;

    if (isMasterUser) {
      isAuthorized = true;
      userRole = 'admin';
      candidatePhone = MASTER_PHONE;
    } else if (normalized) {
      // 5. Consulta da função RPC Supabase is_admin() e da tabela funcionarios
      try {
        // Invoca a função Supabase is_admin() existente
        const { data: rpcAdmin, error: rpcErr } = await supabaseAdmin.rpc('is_admin');
        if (!rpcErr && rpcAdmin === true) {
          isAuthorized = true;
          userRole = 'admin';
        }
      } catch {
        // Se a chamada RPC falhar, valida por telemóvel na base de dados
      }

      if (!isAuthorized) {
        try {
          const { data: funcionario, error: funcErr } = await supabaseAdmin
            .from('funcionarios')
            .select('id, nome_completo, role, ativo')
            .eq('telemovel', normalized)
            .eq('ativo', true)
            .maybeSingle();

          if (!funcErr && funcionario && (funcionario.role === 'admin' || funcionario.role === 'master')) {
            isAuthorized = true;
            userRole = 'admin';
            userId = funcionario.id;
            userName = funcionario.nome_completo;
          }
        } catch (dbErr) {
          console.warn('[verifyAdmin] Erro na consulta de permissão:', dbErr);
        }
      }
    } else if (userRole === 'admin' || userRole === 'master') {
      // Se autenticado com token válido de role admin
      isAuthorized = true;
      candidatePhone = MASTER_PHONE;
    }

    // Em ambiente de desenvolvimento/preview, se o token ou sessão tiver role admin, concede acesso
    if (!isAuthorized && (userRole === 'admin' || userRole === 'master')) {
      isAuthorized = true;
      candidatePhone = MASTER_PHONE;
    }

    if (!isAuthorized) {
      console.warn(`[verifyAdmin] Tentativa de acesso não autorizada a ${req.method} ${req.path}`);
      res.status(403).json({
        success: false,
        error: 'Acesso Negado',
        message: 'Acesso restrito: Privilégios de Administrador Master necessários.',
      });
      return;
    }

    const effectivePhone = normalized || candidatePhone || MASTER_PHONE;

    // REQUISITO CRÍTICO: Registo do log a cada operação de escrita
    console.log(`[ADMIN] Ação executada por ${effectivePhone}`);

    req.adminUser = {
      id: userId || 'usr-master-admin',
      telemovel: effectivePhone,
      role: 'admin',
      nome_completo: userName || 'Administrador Master',
    };

    next();
  } catch (err: any) {
    console.error('[verifyAdmin] Erro no middleware:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao validar permissões de administração.',
    });
  }
}
