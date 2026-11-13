export function isSocketTokenActive(
  tokenExpiresAt: unknown,
  now: number = Date.now()
): boolean {
  return (
    typeof tokenExpiresAt === 'number' &&
    Number.isFinite(tokenExpiresAt) &&
    now < tokenExpiresAt
  );
}
