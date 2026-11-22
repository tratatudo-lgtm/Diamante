/** Normalize Evolution webhook event names across API versions. */
export function normalizeEvolutionEventName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[._-]/g, '_');
}
