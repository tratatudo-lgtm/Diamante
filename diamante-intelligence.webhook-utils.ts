/** Normalize Evolution webhook event names across API versions. */
export function normalizeEvolutionEventName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[._-]/g, '_');
}

export type EvolutionTextMessage = { id: string; jid: string; text: string; fromMe: boolean };

/** Extract only supported text/caption payloads from Evolution message-upsert variants. */
export function extractEvolutionTextMessage(body: any): EvolutionTextMessage | null {
  const payload = body?.data || body;
  const item = payload?.messages?.[0];
  const key = payload?.key || item?.key;
  const message = payload?.message || item?.message;
  const jid = typeof key?.remoteJid === 'string' ? key.remoteJid : '';
  const id = typeof key?.id === 'string' ? key.id : '';
  const candidates = [
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.imageMessage?.caption,
    message?.videoMessage?.caption,
  ];
  const text = candidates.find((value) => typeof value === 'string' && value.trim());
  if (!id || !jid || typeof text !== 'string') return null;
  return { id, jid, text: text.trim(), fromMe: key?.fromMe === true };
}

/** A failed AI step is safe to retry; an attempted external send has an ambiguous outcome. */
export function getWebhookFailureStatus(sendAttempted: boolean): 'failed' | 'unknown' {
  return sendAttempted ? 'unknown' : 'failed';
}

/** Only process explicitly identified Evolution message-upsert events. */
export function isSupportedEvolutionEvent(value: unknown): boolean {
  return normalizeEvolutionEventName(value) === 'messages_upsert';
}
