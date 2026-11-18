import { isUuid } from './store-declaration-access';

export interface StoreScopeActor {
  id: string;
  role: string;
  loja_id: string | null;
  ativo: boolean;
}

export type StoreScopeResult =
  | { ok: true; lojaId: string; actorRole: 'admin' | 'funcionario' }
  | { ok: false; status: 400 | 403; message: string };

/**
 * Resolve the requested store without trusting a client-selected store for staff.
 * The caller must additionally verify that the resolved store exists and is active.
 */
export function resolveStoreScope(
  actor: StoreScopeActor | null | undefined,
  requestedStoreId?: unknown,
): StoreScopeResult {
  if (!actor?.id || actor.ativo !== true) {
    return { ok: false, status: 403, message: 'A sua conta não está activa.' };
  }

  if (actor.role === 'funcionario') {
    if (!actor.loja_id || !isUuid(actor.loja_id)) {
      return { ok: false, status: 403, message: 'A sua conta não tem uma loja associada.' };
    }
    if (requestedStoreId !== undefined && requestedStoreId !== null &&
        requestedStoreId !== '' && requestedStoreId !== actor.loja_id) {
      return { ok: false, status: 403, message: 'Só pode operar na loja que lhe está atribuída.' };
    }
    return { ok: true, lojaId: actor.loja_id, actorRole: 'funcionario' };
  }

  if (actor.role === 'admin') {
    if (typeof requestedStoreId !== 'string' || !isUuid(requestedStoreId)) {
      return { ok: false, status: 400, message: 'Seleccione uma loja válida para continuar.' };
    }
    return { ok: true, lojaId: requestedStoreId, actorRole: 'admin' };
  }

  return { ok: false, status: 403, message: 'A sua conta não tem permissões para operar lojas.' };
}
