import { isUuid } from './store-declaration-access';

export interface StoreInventoryDispatchInput {
  itemId: string;
  storeId: string;
  employeeId: string;
}

export interface StoreInventoryDispatchItem {
  id: string;
  codigo_unico: string;
  estado: string;
  data_saida: string;
  peso_gramas: number;
  transacao_origem_id: string | null;
}

export interface StoreInventoryDispatchRepository {
  dispatch(input: StoreInventoryDispatchInput & { dispatchedAt: string }): Promise<{
    data: StoreInventoryDispatchItem | null;
    error?: unknown | null;
  }>;
}

export type StoreInventoryDispatchResult =
  | { status: 200; item: StoreInventoryDispatchItem }
  | { status: 400 | 409 | 503; message: string };

export async function dispatchStoreInventoryItem(
  input: StoreInventoryDispatchInput,
  repository: StoreInventoryDispatchRepository,
  now: () => string = () => new Date().toISOString(),
): Promise<StoreInventoryDispatchResult> {
  if (!isUuid(input.itemId) || !isUuid(input.storeId) || !input.employeeId.trim()) {
    return { status: 400, message: 'Identificador de inventário ou loja inválido.' };
  }

  try {
    const { data, error } = await repository.dispatch({ ...input, dispatchedAt: now() });
    if (error) return { status: 503, message: 'Não foi possível registar a expedição do inventário.' };
    if (!data) return { status: 409, message: 'A peça já não está disponível nesta loja ou já foi expedida.' };
    return { status: 200, item: data };
  } catch {
    return { status: 503, message: 'Não foi possível registar a expedição do inventário.' };
  }
}
