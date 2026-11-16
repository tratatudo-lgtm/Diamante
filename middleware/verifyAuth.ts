// PATH: middleware/verifyAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../auth.service';

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: {
    id: string;
    nome_completo: string;
    email: string;
    role: string;
    loja_id: string | null;
    telemovel?: string;
    ativo: true;
  };
}

/** Validates a server-issued API JWT and reloads the active employee from Supabase. */
export async function verifyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const secret = process.env.JWT_SECRET;
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

    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, nome_completo, email, role, loja_id, telemovel, ativo')
      .eq('id', userId)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      res.status(503).json({ success: false, message: 'Não foi possível validar a sessão.' });
      return;
    }

    if (!data || data.id !== userId || data.ativo !== true ||
        typeof data.nome_completo !== 'string' || !data.nome_completo.trim() ||
        typeof data.role !== 'string' || !data.role.trim()) {
      res.status(401).json({ success: false, message: 'Sessão inválida ou conta inativa.' });
      return;
    }

    req.authenticatedUser = {
      id: data.id,
      nome_completo: data.nome_completo.trim(),
      email: typeof data.email === 'string' ? data.email : '',
      role: data.role.trim().toLowerCase(),
      loja_id: data.loja_id ?? null,
      telemovel: typeof data.telemovel === 'string' ? data.telemovel : undefined,
      ativo: true,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
  }
}
