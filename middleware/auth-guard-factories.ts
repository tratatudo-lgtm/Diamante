import type { NextFunction, Request, Response, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthGuardEmployee {
  id: string;
  nome_completo: string;
  email?: string | null;
  role: string;
  loja_id: string | null;
  telemovel?: string | null;
  ativo: boolean;
  lojas?: { nome?: string | null; codigo_loja?: string | null } | Array<{ nome?: string | null; codigo_loja?: string | null }> | null;
}

interface EmployeeQuery {
  eq(column: string, value: unknown): EmployeeQuery;
  maybeSingle(): Promise<{ data: AuthGuardEmployee | null; error: unknown | null }>;
}

export interface AuthGuardSupabaseClient {
  from(table: string): {
    select(columns: string): EmployeeQuery;
  };
}

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: {
    id: string;
    nome_completo: string;
    email: string;
    role: string;
    loja_id: string | null;
    loja_nome?: string | null;
    codigo_loja?: string | null;
    telemovel?: string;
    ativo: boolean;
  };
}

export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    telemovel?: string;
    role: string;
    nome_completo?: string;
  };
}

export function createVerifyAuth(
  supabase: AuthGuardSupabaseClient,
  getJwtSecret: () => string | undefined
): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    const secret = getJwtSecret();
    if (!secret) {
      res.status(503).json({ success: false, message: 'Autenticação indisponível.' });
      return;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Autenticação obrigatória.' });
      return;
    }

    try {
      const claims = jwt.verify(header.slice(7).trim(), secret) as jwt.JwtPayload;
      const userId = typeof claims.id === 'string' ? claims.id : '';
      if (!userId) {
        res.status(401).json({ success: false, message: 'Sessão inválida.' });
        return;
      }

      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, email, role, loja_id, telemovel, ativo, lojas(nome, codigo_loja)')
        .eq('id', userId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        res.status(503).json({ success: false, message: 'Não foi possível validar a sessão.' });
        return;
      }
      if (!data) {
        res.status(401).json({ success: false, message: 'Sessão inválida ou conta inativa.' });
        return;
      }

      const fullName = typeof data.nome_completo === 'string' ? data.nome_completo.trim() : '';
      const userRole = typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';
      if (data.ativo !== true || data.id !== userId || !fullName || !userRole) {
        res.status(401).json({
          success: false,
          message: 'Sessão inválida ou perfil de funcionário incompleto.',
        });
        return;
      }

      const store = Array.isArray(data.lojas) ? data.lojas[0] : data.lojas;
      req.authenticatedUser = {
        id: data.id,
        nome_completo: fullName,
        email: typeof data.email === 'string' ? data.email : '',
        role: userRole,
        loja_id: data.loja_id ?? null,
        loja_nome: typeof store?.nome === 'string' ? store.nome : null,
        codigo_loja: typeof store?.codigo_loja === 'string' ? store.codigo_loja : null,
        telemovel: typeof data.telemovel === 'string' ? data.telemovel : undefined,
        ativo: true,
      };
      _next();
    } catch {
      res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
    }
  };
}

export function createVerifyAdmin(
  supabase: AuthGuardSupabaseClient,
  getJwtSecret: () => string | undefined
): RequestHandler {
  return async (req: AdminRequest, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const secret = getJwtSecret();
      if (!secret) {
        res.status(503).json({ success: false, message: 'Autenticação indisponível.' });
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Autenticação obrigatória.' });
        return;
      }

      let decoded: jwt.JwtPayload;
      try {
        decoded = jwt.verify(authHeader.slice(7).trim(), secret) as jwt.JwtPayload;
      } catch {
        res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
        return;
      }

      const userId = typeof decoded.id === 'string' ? decoded.id : '';
      if (!userId) {
        res.status(401).json({ success: false, message: 'Sessão sem identificador de utilizador.' });
        return;
      }

      const { data: employee, error } = await supabase
        .from('funcionarios')
        .select('id, nome_completo, telemovel, role, ativo')
        .eq('id', userId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        res.status(503).json({ success: false, message: 'Não foi possível validar as permissões.' });
        return;
      }

      const role = typeof employee?.role === 'string' ? employee.role.trim().toLowerCase() : '';
      if (!employee || employee.ativo !== true || role !== 'admin') {
        res.status(403).json({ success: false, message: 'Acesso reservado a administradores autorizados.' });
        return;
      }

      req.adminUser = {
        id: employee.id,
        telemovel: employee.telemovel || undefined,
        role,
        nome_completo: employee.nome_completo || undefined,
      };
      _next();
    } catch {
      res.status(500).json({ success: false, message: 'Erro interno ao validar permissões.' });
    }
  };
}
