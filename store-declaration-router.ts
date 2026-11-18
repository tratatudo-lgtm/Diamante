import { Router, type Request, type RequestHandler, type Response } from 'express';
import { createHash } from 'node:crypto';
import { canAccessPurchaseDeclaration, isUuid } from './store-declaration-access';

export interface StoreDeclarationPurchase {
  id: string;
  loja_id: string | null;
  declaracao_assinada_id: string | null;
}

export interface StoreDeclarationEvidence {
  id: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  sha256: string;
  versao_declaracao: string | null;
}

export interface StoreDeclarationAccessLog {
  transacao_id: string;
  evidence_id: string;
  accessed_by: string;
  accessed_role: string;
  sha256_verified: boolean;
}

export interface StoreDeclarationRepository {
  getPurchase(id: string): Promise<{ data: StoreDeclarationPurchase | null; error?: unknown | null }>;
  getEvidence(id: string): Promise<{ data: StoreDeclarationEvidence | null; error?: unknown | null }>;
  download(path: string): Promise<{ data: Uint8Array | null; error?: unknown | null }>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<{ data: { signedUrl?: string } | null; error?: unknown | null }>;
  recordAccess(log: StoreDeclarationAccessLog): Promise<{ error?: unknown | null }>;
}

export interface StoreDeclarationRouterDependencies {
  repository: StoreDeclarationRepository;
  verifyAuth: RequestHandler;
  verifyAdmin: RequestHandler;
}

interface DeclarationActor {
  id: string;
  role: string;
  lojaId: string | null;
}

interface EmployeeRequest extends Request {
  authenticatedUser?: {
    id: string;
    role: string;
    loja_id: string | null;
    ativo: boolean;
  };
}

interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    role: string;
  };
}

async function deliverPurchaseDeclaration(
  purchaseId: string,
  actor: DeclarationActor,
  repository: StoreDeclarationRepository,
  res: Response
): Promise<void> {
  if (!isUuid(purchaseId)) {
    res.status(400).json({ success: false, message: 'Identificador de compra inválido.' });
    return;
  }

  try {
    const { data: purchase, error: purchaseError } = await repository.getPurchase(purchaseId);
    if (purchaseError) {
      console.error('[Store Declaration] Falha ao consultar a compra.');
      res.status(503).json({ success: false, message: 'Não foi possível validar a compra.' });
      return;
    }
    if (!purchase) {
      res.status(404).json({ success: false, message: 'Compra não encontrada.' });
      return;
    }
    if (!canAccessPurchaseDeclaration(actor, purchase.loja_id)) {
      res.status(403).json({ success: false, message: 'Não tem autorização para consultar documentos desta loja.' });
      return;
    }
    if (!purchase.declaracao_assinada_id) {
      res.status(404).json({ success: false, message: 'Esta compra não tem declaração arquivada.' });
      return;
    }

    const { data: evidence, error: evidenceError } = await repository.getEvidence(purchase.declaracao_assinada_id);
    if (evidenceError || !evidence) {
      console.error('[Store Declaration] Evidência associada indisponível.');
      res.status(503).json({ success: false, message: 'Não foi possível validar o documento arquivado.' });
      return;
    }

    const { data: file, error: downloadError } = await repository.download(evidence.storage_path);
    if (downloadError || !file) {
      console.error('[Store Declaration] Falha ao obter o ficheiro privado.');
      res.status(503).json({ success: false, message: 'O documento não está temporariamente disponível.' });
      return;
    }

    const bytes = Buffer.from(file);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== Number(evidence.tamanho_bytes) || actualHash !== evidence.sha256) {
      console.error('[Store Declaration] Integridade documental não confirmada.');
      res.status(409).json({ success: false, message: 'A integridade do documento não pôde ser confirmada. O acesso foi bloqueado.' });
      return;
    }

    const { data: signed, error: signedError } = await repository.createSignedUrl(evidence.storage_path, 60);
    if (signedError || !signed?.signedUrl) {
      console.error('[Store Declaration] Falha ao criar URL temporário.');
      res.status(503).json({ success: false, message: 'Não foi possível disponibilizar o documento.' });
      return;
    }

    const { error: auditError } = await repository.recordAccess({
      transacao_id: purchase.id,
      evidence_id: evidence.id,
      accessed_by: actor.id,
      accessed_role: actor.role,
      sha256_verified: true,
    });
    if (auditError) {
      console.error('[Store Declaration] Falha ao registar auditoria; URL não disponibilizado.');
      res.status(503).json({ success: false, message: 'Não foi possível registar o acesso ao documento.' });
      return;
    }

    res.status(200).json({
      success: true,
      url: signed.signedUrl,
      expiresInSeconds: 60,
      mimeType: evidence.mime_type,
      sha256: actualHash,
      declarationVersion: evidence.versao_declaracao,
    });
  } catch {
    console.error('[Store Declaration] Erro interno ao consultar documento.');
    res.status(500).json({ success: false, message: 'Erro interno ao consultar a declaração.' });
  }
}

export function createStoreDeclarationRouter({
  repository,
  verifyAuth,
  verifyAdmin,
}: StoreDeclarationRouterDependencies) {
  const router = Router();

  router.get('/purchases/:id/declaration', verifyAuth, async (req: EmployeeRequest, res: Response) => {
    const employee = req.authenticatedUser;
    if (!employee?.ativo || employee.role !== 'funcionario' || !employee.loja_id) {
      res.status(403).json({ success: false, message: 'A consulta de declarações está reservada a funcionários ativos da loja.' });
      return;
    }

    await deliverPurchaseDeclaration(req.params.id, {
      id: employee.id,
      role: employee.role,
      lojaId: employee.loja_id,
    }, repository, res);
  });

  router.get('/admin/purchases/:id/declaration', verifyAdmin, async (req: AdminRequest, res: Response) => {
    const admin = req.adminUser;
    if (!admin?.id || admin.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Acesso reservado a administradores ativos.' });
      return;
    }

    await deliverPurchaseDeclaration(req.params.id, {
      id: admin.id,
      role: 'admin',
      lojaId: null,
    }, repository, res);
  });

  return router;
}
