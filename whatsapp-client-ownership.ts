/**
 * A receipt can only be read when its transaction belongs to the authenticated
 * customer. Never accept a client ID from URL, query string or request body.
 */
export function ownsClientTransaction(
  authenticatedClientId: string,
  transaction: { cliente_id?: string | null } | null | undefined,
): boolean {
  return Boolean(authenticatedClientId && transaction?.cliente_id &&
    transaction.cliente_id === authenticatedClientId);
}

/**
 * Only private Supabase Storage paths in an explicitly configured bucket are
 * eligible for short-lived download links. Reject public/external URLs.
 */
export function parsePrivateReceiptPath(
  raw: unknown,
  bucket: string,
): string | null {
  if (typeof raw !== 'string' || !bucket || !/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(bucket)) return null;
  if (raw.includes('://') || raw.startsWith('/') || raw.includes('\\') || raw.includes('?') || raw.includes('#')) return null;
  const path = raw.startsWith(bucket + '/') ? raw.slice(bucket.length + 1) : raw;
  if (!path || path.length > 512 || path.split('/').some(p => !p || p === '.' || p === '..')) return null;
  if (!/^[a-zA-Z0-9/_ .-]+$/.test(path) || !/\.pdf$/i.test(path)) return null;
  return path;
}
