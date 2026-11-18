export interface DeclarationAccessActor {
  id: string;
  role: string;
  lojaId: string | null;
}

export function canAccessPurchaseDeclaration(
  actor: DeclarationAccessActor,
  purchaseStoreId: string | null | undefined
): boolean {
  if (!actor.id || !purchaseStoreId) return false;
  return (actor.role === 'admin' || actor.role === 'funcionario') &&
    Boolean(actor.lojaId) && actor.lojaId === purchaseStoreId;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
