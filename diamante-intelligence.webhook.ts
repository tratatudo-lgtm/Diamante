import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './auth.service';
import { generateDiamanteIntelligenceReply } from './diamante-intelligence.service';
import { extractEvolutionTextMessage, getWebhookFailureStatus, normalizeEvolutionEventName } from './diamante-intelligence.webhook-utils';

const router = Router();
const senderWindows = new Map<string, { count: number; resetAt: number }>();
const SENDER_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_SENDER = 8;
const MAX_TRACKED_SENDERS = 10000;

function pruneSenderWindows(now: number): void {
  for (const [sender, window] of senderWindows) {
    if (now >= window.resetAt) senderWindows.delete(sender);
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

  // Evolution API envia o nome do evento como MESSAGES_UPSERT (underscore).
  // Aceitar também a forma messages.upsert para compatibilidade entre versões.
  const event = normalizeEvolutionEventName(req.body?.event);
  if (event && event !== 'messages_upsert') return res.status(200).json({ success: true, ignored: true });

  const incoming = extractEvolutionTextMessage(req.body);
  if (!incoming || incoming.fromMe || incoming.jid.endsWith('@g.us') || incoming.jid === 'status@broadcast') {
    return res.status(200).json({ success: true, ignored: true });
  }

  const now = Date.now();
  pruneSenderWindows(now);
  const instanceName = process.env.EVOLUTION_INSTANCE || 'diamante-os';
  const window = senderWindows.get(incoming.jid);
  if (window && now < window.resetAt && window.count >= MAX_MESSAGES_PER_SENDER) {
    return res.status(200).json({ success: true, rateLimited: true });
  }
  if (!window || now >= window.resetAt) senderWindows.set(incoming.jid, { count: 1, resetAt: now + SENDER_WINDOW_MS });
  else window.count += 1;
  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('whatsapp_conversations')
    .upsert({ instance_name: instanceName, remote_jid: incoming.jid, contact_phone: incoming.jid.split('@')[0].split(':')[0].replace(/\D/g, ''), last_message_at: new Date().toISOString() }, { onConflict: 'instance_name,remote_jid' })
    .select('id,mode')
    .single();
  if (conversationError || !conversation) {
    console.error('[Diamante Intelligence] Não foi possível registar a conversa.');
    return res.status(503).json({ success: false });
  }
  const { error: inboundMessageError } = await supabaseAdmin.from('whatsapp_messages')
    .insert({ conversation_id: conversation.id, external_message_id: incoming.id, direction: 'inbound', sender_type: 'customer', body: incoming.text, status: 'received' });
  if (inboundMessageError && inboundMessageError.code !== '23505') {
    console.error('[Diamante Intelligence] Não foi possível guardar a mensagem recebida.');
    return res.status(503).json({ success: false });
  }
  if (conversation.mode === 'human') {
    return res.status(200).json({ success: true, humanTakeover: true });
  }

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

  let sendAttempted = false;
  let aiMessageId: string | null = null;
  try {
    const reply = await generateDiamanteIntelligenceReply(incoming.jid, incoming.text);
    // Reserva atómica da conversa: takeover e envio automático competem pela mesma linha.
    // A reserva não expira automaticamente: uma execução antiga nunca pode ser
    // ultrapassada por takeover nem concorrer com um segundo envio após pausa/crash.
    // Reservas abandonadas exigem revisão operacional antes de serem libertadas.
    const sendClaimToken = String(eventRow.id);
    const { data: sendClaim, error: claimError } = await supabaseAdmin.from('whatsapp_conversations')
      .update({ ai_send_token: sendClaimToken, ai_send_started_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('mode', 'ai')
      .is('ai_send_token', null)
      .select('id')
      .maybeSingle();
    if (claimError || !sendClaim) {
      await supabaseAdmin.from('diamante_intelligence_webhook_events')
        .update({ status: 'ignored', error_code: 'HUMAN_TAKEOVER_OR_SEND_IN_PROGRESS', processed_at: new Date().toISOString() })
        .eq('id', eventRow.id)
        .eq('status', 'processing');
      return res.status(200).json({ success: true, humanTakeover: true, sendInProgress: true });
    }
    const { data: aiMessage, error: aiInsertError } = await supabaseAdmin.from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, direction: 'outbound', sender_type: 'ai', body: reply, status: 'sending' })
      .select('id').maybeSingle();
    if (aiInsertError || !aiMessage) throw new Error('WHATSAPP_AI_MESSAGE_LOG_FAILED');
    aiMessageId = aiMessage.id;
    // Persistir o estado antes do pedido externo. Se o processo cair durante o envio,
    // o evento fica em 'sending' e nunca é repetido automaticamente.
    const sending = await supabaseAdmin.from('diamante_intelligence_webhook_events')
      .update({ status: 'sending', error_code: null })
      .eq('id', eventRow.id)
      .eq('status', 'processing')
      .select('id')
      .maybeSingle();
    if (sending.error || !sending.data) throw new Error('WEBHOOK_STATE_TRANSITION_FAILED');
    sendAttempted = true;
    await sendEvolutionText(number, reply);
    await supabaseAdmin.from('whatsapp_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', aiMessageId).eq('status', 'sending');
    await supabaseAdmin.from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString(), ai_send_token: null, ai_send_started_at: null })
      .eq('id', conversation.id)
      .eq('ai_send_token', sendClaimToken);
    await supabaseAdmin.from('diamante_intelligence_webhook_events')
      .update({ status: 'sent', processed_at: new Date().toISOString() })
      .eq('id', eventRow.id)
      .eq('status', 'sending');
    return res.status(200).json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status = getWebhookFailureStatus(sendAttempted);
    console.error(`[Diamante Intelligence] Mensagem não processada: ${code}.`);
    if (aiMessageId) {
      await supabaseAdmin.from('whatsapp_messages')
        .update({ status: sendAttempted ? 'unknown' : 'failed' }).eq('id', aiMessageId).eq('status', 'sending');
    }
    // Antes de qualquer pedido externo, a reserva pode ser libertada.
    // Depois de iniciar o envio, o resultado pode ser ambíguo: manter a reserva
    // bloqueada até reconciliação explícita evita takeover enquanto a mensagem
    // ainda pode estar a ser entregue no WhatsApp.
    if (!sendAttempted) {
      await supabaseAdmin.from('whatsapp_conversations')
        .update({ ai_send_token: null, ai_send_started_at: null })
        .eq('id', conversation.id)
        .eq('ai_send_token', eventRow.id);
    }
    await supabaseAdmin.from('diamante_intelligence_webhook_events')
      .update({ status, error_code: code.slice(0, 80), processed_at: new Date().toISOString() })
      .eq('id', eventRow.id)
      .in('status', sendAttempted ? ['sending'] : ['processing']);
    return res.status(200).json({ success: true, processed: false, delivery: sendAttempted ? 'unknown' : 'not_sent' });
  }
});

export default router;
