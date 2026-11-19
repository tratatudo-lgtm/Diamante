import { requiresSecondPurchaseApproval } from './store-purchase-validation';

export interface PurchaseApprovalTransaction {
  id: string;
  loja_id: string | null;
  estado: string;
  valor_final: number | string;
  primeira_aprovacao_por: string | null;
}

export interface PurchaseApprovalSettings {
  exigir_dupla_assinatura?: boolean;
  exigir_dupla_assinatura_acima?: number | string;
}

export interface PurchaseApprovalRepository {
  getTransaction(id: string): Promise<PurchaseApprovalTransaction | null>;
  getSettings(): Promise<PurchaseApprovalSettings | null>;
  recordFirstApproval(id: string, adminId: string, at: string): Promise<boolean>;
  approve(id: string, adminId: string, at: string, requireDifferentAdmin: boolean): Promise<{
    id: string;
    loja_id: string | null;
  } | null>;
}

export type PurchaseApprovalResult =
  | { status: 400 | 401 | 409 | 503; body: { success: false; error: string } }
  | { status: 200; body: { success: true; requiresSecondApproval: true; message: string; transactionId: string } }
  | { status: 200; body: { success: true; requiresSecondApproval: false; message: string; transactionId: string }; approved: { id: string; loja_id: string | null }; approvedAt: string };

export async function authorizePurchase(input: {
  transactionId: string;
  adminId: string;
  repository: PurchaseApprovalRepository;
  now?: () => string;
}): Promise<PurchaseApprovalResult> {
  const { transactionId, adminId, repository } = input;
  const now = (input.now ?? (() => new Date().toISOString()))();

  const [transaction, settings] = await Promise.all([
    repository.getTransaction(transactionId),
    repository.getSettings(),
  ]);

  if (!transaction) {
    return { status: 409, body: { success: false, error: 'A compra não está pendente ou já foi processada.' } };
  }
  if (transaction.estado !== 'pendente_aprovacao') {
    return { status: 409, body: { success: false, error: 'A compra não está pendente ou já foi processada.' } };
  }

  const enabled = settings?.exigir_dupla_assinatura === true;
  const threshold = enabled ? Number(settings?.exigir_dupla_assinatura_acima) || 0 : 0;
  const requiresDoubleSignature = requiresSecondPurchaseApproval(transaction, enabled, threshold);

  if (requiresDoubleSignature && !transaction.primeira_aprovacao_por) {
    const recorded = await repository.recordFirstApproval(transactionId, adminId, now);
    if (!recorded) {
      return { status: 409, body: { success: false, error: 'A primeira assinatura foi registada por outro administrador. Actualize a lista.' } };
    }
    return {
      status: 200,
      body: {
        success: true,
        requiresSecondApproval: true,
        message: 'Primeira assinatura registada. É necessária a aprovação de um segundo administrador.',
        transactionId,
      },
    };
  }

  if (requiresDoubleSignature && transaction.primeira_aprovacao_por === adminId) {
    return { status: 409, body: { success: false, error: 'A segunda assinatura tem de ser realizada por um administrador diferente.' } };
  }

  const approved = await repository.approve(transactionId, adminId, now, requiresDoubleSignature);
  if (!approved) {
    return { status: 409, body: { success: false, error: 'A compra foi entretanto processada por outro administrador.' } };
  }

  return {
    status: 200,
    body: {
      success: true,
      requiresSecondApproval: false,
      message: 'Compra aprovada com sucesso.',
      transactionId: approved.id,
    },
    approved,
    approvedAt: now,
  };
}
