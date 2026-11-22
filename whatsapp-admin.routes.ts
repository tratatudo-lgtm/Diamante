import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin, AdminRequest } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sendEvolutionText(number: string, text: string, instance: string): Promise<void> {
  const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY || '';
  if (!baseUrl || !apiKey || !instance) throw new Error('EVOLUTION_NOT_CONFIGURED');
  const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number, text, options: { delay: 800, presence: 'composing' } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('EVOLUTION_SEND_FAILED');
}

router.get('/conversations', async (req: AdminRequest, res: Response) => {
  const requested = Number(req.query.limit || 100);
  const limit = Number.isInteger(requested) ? Math.min(200, Math.max(1, requested)) : 100;
  try {
    const { data, error } = await supabaseAdmin.from('whatsapp_conversations')
      .select('id,instance_name,remote_jid,contact_phone,mode,status,assigned_admin_id,last_message_at,created_at')
      .order('last_message_at', { ascending: false }).limit(limit);
    if (error) throw error;
    const ids = (data || []).map((item: any) => item.id);
    const { data: messages, error: messagesError } = ids.length
      ? await supabaseAdmin.from('whatsapp_messages')
          .select('conversation_id,body,direction,sender_type,status,created_at')
          .in('conversation_id', ids).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (messagesError) throw messagesError;
    const latest = new Map<string, any>();
    for (const message of messages || []) if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
    return res.json({ success: true, conversations: (data || []).map((item: any) => ({ ...item, last_message: latest.get(item.id) || null })) });
  } catch {
    console.error('[WhatsApp Admin] Falha ao listar conversas.');
    return res.status(503).json({ success: false, message: 'Não foi possível carregar as conversas WhatsApp.' });
  }
});


router.get('/audit', async (req: AdminRequest, res: Response) => {
  const requested = Number(req.query.limit || 100);
  const limit = Number.isInteger(requested) ? Math.min(200, Math.max(1, requested)) : 100;
  const conversationId = req.query.conversationId;
  const adminId = req.query.adminId;
  const action = req.query.action;
  const outcome = req.query.outcome;
  const from = req.query.from;
  const to = req.query.to;
  const allowedActions = ['control_taken','control_released','admin_message_created','admin_message_sent','admin_message_failed','admin_message_unknown','conversation_status_changed'];
  if (conversationId !== undefined && !validUuid(conversationId)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  if (adminId !== undefined && !validUuid(adminId)) return res.status(400).json({ success: false, message: 'Administrador inválido.' });
  if (action !== undefined && (typeof action !== 'string' || !allowedActions.includes(action))) return res.status(400).json({ success: false, message: 'Tipo de intervenção inválido.' });
  if (outcome !== undefined && !['success','failed','unknown'].includes(String(outcome))) return res.status(400).json({ success: false, message: 'Resultado inválido.' });
  const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
  if (from !== undefined && !validDate(from)) return res.status(400).json({ success: false, message: 'Data inicial inválida.' });
  if (to !== undefined && !validDate(to)) return res.status(400).json({ success: false, message: 'Data final inválida.' });
  if (typeof from === 'string' && typeof to === 'string' && from > to) return res.status(400).json({ success: false, message: 'O período indicado é inválido.' });
  try {
    let query = supabaseAdmin.from('whatsapp_admin_audit')
      .select('id,conversation_id,admin_id,action,outcome,metadata,created_at')
      .order('created_at', { ascending: false }).limit(limit);
    if (typeof conversationId === 'string') query = query.eq('conversation_id', conversationId);
    if (typeof adminId === 'string') query = query.eq('admin_id', adminId);
    if (typeof action === 'string') query = query.eq('action', action);
    if (typeof outcome === 'string') query = query.eq('outcome', outcome);
    if (typeof from === 'string') query = query.gte('created_at', from + 'T00:00:00.000Z');
    if (typeof to === 'string') query = query.lt('created_at', new Date(Date.parse(to + 'T00:00:00.000Z') + 86400000).toISOString());
    const { data, error } = await query;
    if (error) throw error;
    const adminIds = [...new Set((data || []).map((event: any) => event.admin_id).filter(Boolean))];
    const { data: admins, error: adminsError } = adminIds.length
      ? await supabaseAdmin.from('funcionarios').select('id,nome_completo,email').in('id', adminIds)
      : { data: [], error: null };
    if (adminsError) throw adminsError;
    const adminById = new Map((admins || []).map((admin: any) => [admin.id, admin]));
    return res.json({
      success: true,
      events: (data || []).map((event: any) => ({
        ...event,
        admin_name: adminById.get(event.admin_id)?.nome_completo || null,
        admin_email: adminById.get(event.admin_id)?.email || null,
      })),
    });
  } catch {
    console.error('[WhatsApp Admin] Falha ao carregar auditoria.');
    return res.status(503).json({ success: false, message: 'Não foi possível carregar a auditoria.' });
  }
});

router.get('/conversations/:id/messages', async (req: AdminRequest, res: Response) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  try {
    const { data, error } = await supabaseAdmin.from('whatsapp_messages')
      .select('id,external_message_id,direction,sender_type,body,status,admin_id,created_at,sent_at')
      .eq('conversation_id', req.params.id).order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return res.json({ success: true, messages: (data || []).reverse() });
  } catch {
    console.error('[WhatsApp Admin] Falha ao carregar mensagens.');
    return res.status(503).json({ success: false, message: 'Não foi possível carregar o histórico.' });
  }
});

router.patch('/conversations/:id/control', async (req: AdminRequest, res: Response) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  const mode = req.body?.mode;
  if (mode !== 'ai' && mode !== 'human') return res.status(400).json({ success: false, message: 'Modo de conversa inválido.' });
  const adminId = req.adminUser?.id;
  if (!adminId) return res.status(401).json({ success: false, message: 'Sessão administrativa inválida.' });
  try {
    let claim = supabaseAdmin.from('whatsapp_conversations')
      .update({
        mode,
        assigned_admin_id: mode === 'human' ? adminId : null,
        last_controlled_by: adminId,
        last_control_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ai_send_token: null,
        ai_send_started_at: null,
      })
      .eq('id', req.params.id);
    // Uma reserva ativa, mesmo antiga, só pode ser libertada após revisão operacional.
    // Não expirar automaticamente: um processo pausado pode ainda retomar o envio.
    claim = mode === 'human'
      ? claim.is('ai_send_token', null).or(`mode.eq.ai,assigned_admin_id.eq.${adminId}`)
      : claim.eq('mode', 'human').eq('assigned_admin_id', adminId)
          .is('ai_send_token', null);
    const { data, error } = await claim
      .select('id,mode,assigned_admin_id,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ success: false, message: 'A conversa já está atribuída a outro administrador ou já não está sob o seu controlo.' });
    return res.json({ success: true, conversation: data });
  } catch {
    console.error('[WhatsApp Admin] Falha ao alterar controlo da conversa.');
    return res.status(503).json({ success: false, message: 'Não foi possível alterar o controlo.' });
  }
});


// Envios incertos não são libertados pela API: exigem paragem operacional
// de todos os workers e reconciliação controlada na base de dados.

router.patch('/conversations/:id/status', async (req: AdminRequest, res: Response) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  const status = req.body?.status;
  if (!['unread', 'in_service', 'pending', 'resolved'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Estado de conversa inválido.' });
  }
  const adminId = req.adminUser?.id;
  if (!adminId) return res.status(401).json({ success: false, message: 'Sessão administrativa inválida.' });
  try {
    const { data: previous, error: previousError } = await supabaseAdmin.from('whatsapp_conversations')
      .select('status').eq('id', req.params.id).maybeSingle();
    if (previousError) throw previousError;
    if (!previous) return res.status(404).json({ success: false, message: 'Conversa não encontrada.' });
    const { data, error } = await supabaseAdmin.from('whatsapp_conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id,status,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Conversa não encontrada.' });
    if (previous.status !== status) {
      const { error: auditError } = await supabaseAdmin.from('whatsapp_admin_audit').insert({
        conversation_id: req.params.id, admin_id: adminId, action: 'conversation_status_changed',
        outcome: 'success', metadata: { previous_status: previous.status, new_status: status },
      });
      if (auditError) throw auditError;
    }
    return res.json({ success: true, conversation: data });
  } catch {
    console.error('[WhatsApp Admin] Falha ao alterar estado da conversa.');
    return res.status(503).json({ success: false, message: 'Não foi possível alterar o estado.' });
  }
});

router.post('/conversations/:id/messages', async (req: AdminRequest, res: Response) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  const body = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const clientMessageId = typeof req.body?.clientMessageId === 'string' ? req.body.clientMessageId : '';
  if (!body || body.length > 4000 || !validUuid(clientMessageId)) {
    return res.status(400).json({ success: false, message: 'Mensagem inválida ou identificador de envio em falta.' });
  }
  const adminId = req.adminUser?.id;
  if (!adminId) return res.status(401).json({ success: false, message: 'Sessão administrativa inválida.' });
  try {
    const { data: conversation, error: conversationError } = await supabaseAdmin.from('whatsapp_conversations')
      .select('id,remote_jid,contact_phone,mode,instance_name').eq('id', req.params.id).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversa não encontrada.' });
    if (conversation.mode !== 'human') return res.status(409).json({ success: false, message: 'Assuma primeiro esta conversa para suspender o Assistente Diamante.' });
    if (!conversation.contact_phone || !/^\d{8,15}$/.test(conversation.contact_phone)) {
      return res.status(409).json({ success: false, message: 'Não é possível enviar: o número de WhatsApp deste contacto ainda não está identificado.' });
    }

    const { data: pending, error: insertError } = await supabaseAdmin.from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, client_message_id: clientMessageId, direction: 'outbound', sender_type: 'admin', body, status: 'sending', admin_id: adminId })
      .select('id').maybeSingle();
    if (insertError?.code === '23505') return res.status(409).json({ success: false, message: 'Este envio já foi registado.' });
    if (insertError || !pending) throw insertError || new Error('MESSAGE_INSERT_FAILED');

    // A reserva é atómica e usa a mesma coluna que bloqueia o envio do Diamante.
    // Assim, devolver o controlo ou assumir a conversa não pode ultrapassar um envio manual.
    const { data: manualClaim, error: claimError } = await supabaseAdmin.from('whatsapp_conversations')
      .update({ ai_send_token: clientMessageId, ai_send_started_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('mode', 'human')
      .eq('assigned_admin_id', adminId)
      .is('ai_send_token', null)
      .select('id')
      .maybeSingle();
    if (claimError || !manualClaim) {
      await supabaseAdmin.from('whatsapp_messages').update({ status: 'failed' }).eq('id', pending.id).eq('status', 'sending');
      if (claimError) throw claimError;
      return res.status(409).json({ success: false, message: 'O controlo humano mudou ou existe outro envio em curso. A mensagem não foi enviada.' });
    }

    try {
      await sendEvolutionText(conversation.contact_phone, body, conversation.instance_name);
      const { error: sentError } = await supabaseAdmin.from('whatsapp_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', pending.id).eq('status', 'sending');
      if (sentError) throw new Error('MESSAGE_STATUS_UPDATE_FAILED');
      await supabaseAdmin.from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString(), ai_send_token: null, ai_send_started_at: null })
        .eq('id', conversation.id).eq('ai_send_token', clientMessageId);
      return res.json({ success: true, messageId: pending.id });
    } catch {
      await supabaseAdmin.from('whatsapp_messages')
        .update({ status: 'unknown' }).eq('id', pending.id).eq('status', 'sending');
      // Manter a reserva: o envio pode ter sido aceite pela Evolution apesar do timeout.
      return res.status(502).json({ success: false, delivery: 'unknown', message: 'O envio foi iniciado mas não foi possível confirmar o resultado. A conversa fica bloqueada até reconciliação manual.' });
    }
  } catch {
    console.error('[WhatsApp Admin] Falha no envio manual.');
    return res.status(503).json({ success: false, message: 'Não foi possível enviar a mensagem.' });
  }
});

export default router;
