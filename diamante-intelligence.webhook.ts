import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './auth.service';
import { generateDiamanteIntelligenceReply } from './diamante-intelligence.service';

const router = Router();
const recentMessages = new Map<string, number>();
const senderWindows = new Map<string, { count: number; resetAt: number }>();
const MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const SENDER_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_SENDER = 8;
const MAX_RECENT_MESSAGES = 5000;
const MAX_TRACKED_SENDERS = 10000;

function pruneMemoryState(now: number): void {
  for (const [key, timestamp] of recentMessages) {
    if (now - timestamp > MESSAGE_CACHE_TTL_MS) recentMessages.delete(key);
  }
  for (const [sender, window] of senderWindows) {
    if (now >= window.resetAt) senderWindows.delete(sender);
  }
  // Limites rígidos evitam crescimento ilimitado em processos de longa duração.
  while (recentMessages.size > MAX_RECENT_MESSAGES) {
    const oldest = recentMessages.keys().next().value;
    if (oldest === undefined) break;
    recentMessages.delete(oldest);
  }
  while (senderWindows.size > MAX_TRACKED_SENDERS) {
    const oldest = senderWindows.keys().next().value;
    if (oldest === undefined) break;
    senderWindows.delete(oldest);
  }
}

function safeSecretMatch(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function extractMessage(body: any): { id: string; jid: string; text: string; fromMe: boolean } | null {
  const payload = body?.data || body;
  const key = payload?.key || payload?.messages?.[0]?.key;
  const message = payload?.message || payload?.messages?.[0]?.message;
  const jid = typeof key?.remoteJid === 'string' ? key.remoteJid : '';
  const id = typeof key?.id === 'string' ? key.id : '';
  const text = [
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.imageMessage?.caption,
    message?.videoMessage?.caption,
  ].find((value) => typeof value === 'string' && value.trim()) || '';
  if (!id || !jid || !text || typeof text !== 'string') return null;
  return { id, jid, text: text.trim(), fromMe: key?.fromMe === true };
}

async function sendEvolutionText(number: string, text: string): Promise<void> {
  const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY || '';
  const instance = process.env.EVOLUTION_INSTANCE || 'diamante-os';
  if (!baseUrl || !apiKey || !instance) throw new Error('EVOLUTION_NOT_CONFIGURED');
  const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number, text, options: { delay: 800, presence: 'composing' } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error(`[Diamante Intelligence] Evolution respondeu HTTP ${response.status}.`);
    throw new Error('EVOLUTION_SEND_FAILED');
  }
}

router.post('/', async (req: Request, res: Response) => {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET || '';
  const received = req.header('x-diamante-webhook-secret') || '';
  if (!expected || !safeSecretMatch(received, expected)) {
    return res.status(401).json({ success: false });
  }

  const event = String(req.body?.event || '').toLowerCase();
  if (event && event !== 'messages.upsert') return res.status(200).json({ success: true, ignored: true });

  const incoming = extractMessage(req.body);
  if (!incoming || incoming.fromMe || incoming.jid.endsWith('@g.us') || incoming.jid === 'status@broadcast') {
    return res.status(200).json({ success: true, ignored: true });
  }

  const now = Date.now();
  pruneMemoryState(now);
  const instanceName = process.env.EVOLUTION_INSTANCE || 'diamante-os';
  const messageCacheKey = `${instanceName}:${incoming.id}`;

  const window = senderWindows.get(incoming.jid);
  if (window && now < window.resetAt && window.count >= MAX_MESSAGES_PER_SENDER) {
    return res.status(200).json({ success: true, rateLimited: true });
  }
  if (!window || now >= window.resetAt) senderWindows.set(incoming.jid, { count: 1, resetAt: now + SENDER_WINDOW_MS });
  else window.count += 1;
  let { data: eventRow, error: eventError } = await supabaseAdmin
    .from('diamante_intelligence_webhook_events')
    .insert({ instance_name: instanceName, message_id: incoming.id, status: 'processing' })
    .select('id')
    .maybeSingle();
  if (eventError?.code === '23505') {
    // Só é seguro repetir uma falha Groq: nesta fase ainda não foi tentado qualquer envio WhatsApp.
    const { data: previous } = await supabaseAdmin
      .from('diamante_intelligence_webhook_events')
      .select('id,status,error_code,retry_count')
      .eq('instance_name', instanceName)
      .eq('message_id', incoming.id)
      .maybeSingle();
    if (previous?.status === 'failed' && typeof previous.error_code === 'string' && previous.error_code.startsWith('GROQ_') && previous.retry_count === 0) {
      const claimed = await supabaseAdmin
        .from('diamante_intelligence_webhook_events')
        .update({ status: 'processing', error_code: null, processed_at: null, retry_count: 1 })
        .eq('id', previous.id)
        .eq('status', 'failed')
        .eq('retry_count', 0)
        .like('error_code', 'GROQ_%')
        .select('id')
        .maybeSingle();
      eventRow = claimed.data;
      eventError = claimed.error;
    }
    if (!eventRow || eventError) return res.status(200).json({ success: true, duplicate: true });
  } else if (eventError || !eventRow) {
    console.error('[Diamante Intelligence] Não foi possível registar o evento recebido.');
    return res.status(503).json({ success: false });
  }
  const number = incoming.jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!number || number.length < 8 || number.length > 15) {
    await supabaseAdmin.from('diamante_intelligence_webhook_events')
      .update({ status: 'ignored', error_code: 'INVALID_SENDER_NUMBER', processed_at: new Date().toISOString() })
      .eq('id', eventRow.id);
    return res.status(200).json({ success: true, ignored: true });
  }

  try {
    const reply = await generateDiamanteIntelligenceReply(incoming.jid, incoming.text);
    await sendEvolutionText(number, reply);
    await supabaseAdmin.from('diamante_intelligence_webhook_events')
      .update({ status: 'sent', processed_at: new Date().toISOString() }).eq('id', eventRow.id);
    recentMessages.set(messageCacheKey, now);
    return res.status(200).json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    console.error(`[Diamante Intelligence] Mensagem não processada: ${code}.`);
    await supabaseAdmin.from('diamante_intelligence_webhook_events')
      .update({ status: 'failed', error_code: code.slice(0, 80), processed_at: new Date().toISOString() }).eq('id', eventRow.id);
    return res.status(200).json({ success: true, processed: false });
  }
});

export default router;
