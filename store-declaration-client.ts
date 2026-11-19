export interface StoreDeclarationRequest {
  transactionId: string;
  storeId?: string;
  token: string;
}

export async function requestStoreDeclarationUrl(
  { transactionId, storeId, token }: StoreDeclarationRequest,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!token.trim()) throw new Error('Sessão administrativa expirada. Volte a iniciar sessão.');
  if (!transactionId.trim()) {
    throw new Error('Identificador de compra inválido.');
  }

  const response = await fetcher(
    `/api/store/admin/purchases/${encodeURIComponent(transactionId)}/declaration`,
    {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  const payload = await response.json().catch(() => null) as { success?: boolean; url?: unknown; message?: string } | null;
  if (!response.ok || payload?.success !== true || typeof payload.url !== 'string') {
    throw new Error(payload?.message || 'Não foi possível validar ou abrir a declaração.');
  }

  let signedUrl: URL;
  try {
    signedUrl = new URL(payload.url);
  } catch {
    throw new Error('O servidor devolveu um endereço de documento inválido.');
  }
  if (signedUrl.protocol !== 'https:' || signedUrl.hostname !== 'ytpetuvvxbmlafsisfaf.supabase.co' || signedUrl.username || signedUrl.password || !signedUrl.pathname.startsWith('/storage/v1/object/sign/')) {
    throw new Error('O endereço temporário do documento não é seguro.');
  }
  return signedUrl.toString();
}
