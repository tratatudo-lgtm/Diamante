export function isOtpActive(expiresAt: unknown, now: number = Date.now()): boolean {
  return (
    typeof expiresAt === 'number' &&
    Number.isFinite(expiresAt) &&
    Number.isFinite(now) &&
    now < expiresAt
  );
}
