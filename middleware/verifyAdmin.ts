// PATH: middleware/verifyAdmin.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../auth.service';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET tem de estar configurado no ambiente do servidor.');
  }
  return secret;
})();

export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    telemovel?: string;
    role: string;
    nome_completo?: string;
  };
}

/**
 * Autoriza exclusivamente funcionários ativos com role "admin" na tabela
 * funcionarios. Cabeçalhos e campos do body nunca são prova de identidade.
 */
export interface VerifyAdminDependencies { secret: string; findActiveEmployee: (id: string) => Promise<{ data: any; error?: unknown | null }>; }

export function createVerifyAdmin(dependencies: VerifyAdminDependencies) {
return async function verifyAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Autenticação obrigatória.' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(authHeader.slice(7).trim(), dependencies.secret);
    } catch {
      res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
      return;
    }

    const userId = typeof decoded?.id === 'string' ? decoded.id : '';
    if (!userId) {
      res.status(401).json({ success: false, message: 'Sessão sem identificador de utilizador.' });
      return;
    }

    const { data: funcionario, error } = await dependencies.findActiveEmployee(userId);

    if (error) {
      console.error('[verifyAdmin] Falha na consulta de permissões do funcionário.');
      res.status(503).json({ success: false, message: 'Não foi possível validar as permissões.' });
      return;
    }

    if (!funcionario || funcionario.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Acesso reservado a administradores autorizados.' });
      return;
    }

    req.adminUser = {
      id: funcionario.id,
      telemovel: funcionario.telemovel || undefined,
      role: funcionario.role,
      nome_completo: funcionario.nome_completo || undefined,
    };

    console.log(`[ADMIN] Pedido administrativo validado: ${req.method} ${req.path}.`);
    next();
  } catch {
    console.error('[verifyAdmin] Erro interno ao validar permissões.');
    res.status(500).json({ success: false, message: 'Erro interno ao validar permissões.' });
  }
};
}

export const verifyAdmin = createVerifyAdmin({
  secret: JWT_SECRET,
  findActiveEmployee: async (id: string) => {
    const { data, error } = await supabaseAdmin.from('funcionarios')
      .select('id, nome_completo, telemovel, role, ativo')
      .eq('id', id).eq('ativo', true).maybeSingle();
    return { data, error };
  },
});
