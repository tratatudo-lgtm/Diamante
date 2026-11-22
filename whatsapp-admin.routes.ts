import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin, AdminRequest } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

router.get('/conversations/:id/messages', async (req: AdminRequest, res: Response) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  try {
    const { data, error } = await supabaseAdmin.from('whatsapp_messages')
      .select('id,external_message_id,direction,sender_type,body,status,admin_id,created_at,sent_at')
      .eq('conversation_id', req.params.id).order('created_at', { ascending: true }).limit(500);
    if (error) throw error;
    return res.json({ success: true, messages: data || [] });
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
      .update({ mode, assigned_admin_id: mode === 'human' ? adminId : null, last_controlled_by: adminId, last_control_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    // Um único administrador pode deter o controlo humano. Evita que dois operadores
    // assumam simultaneamente a mesma conversa ou que um liberte a sessão do outro.
    claim = mode === 'human'
      ? claim.or(`mode.eq.ai,assigned_admin_id.eq.${adminId}`)
      : claim.eq('mode', 'human').eq('assigned_admin_id', adminId);
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


router.patch('/conversations/:id/status', async (req: AdminRequest, res: Response) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Conversa inválida.' });
  const status = req.body?.status;
  if (!['unread', 'in_service', 'pending', 'resolved'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Estado de conversa inválido.' });
  }
  try {
    const { data, error } = await supabaseAdmin.from('whatsapp_conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id,status,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Conversa não encontrada.' });
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

    const { data: pending, error: insertError } = await supabaseAdmin.from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, client_message_id: clientMessageId, direction: 'outbound', sender_type: 'admin', body, status: 'sending', admin_id: adminId })
      .select('id').maybeSingle();
    if (insertError?.code === '23505') return res.status(409).json({ success: false, message: 'Este envio já foi registado.' });
    if (insertError || !pending) throw insertError || new Error('MESSAGE_INSERT_FAILED');

    try {
      const { data: latestConversation, error: latestError } = await supabaseAdmin.from('whatsapp_conversations')
        .select('mode,assigned_admin_id').eq('id', conversation.id).maybeSingle();
      if (latestError || latestConversation?.mode !== 'human' || latestConversation?.assigned_admin_id !== adminId) {
        await supabaseAdmin.from('whatsapp_messages').update({ status: 'failed' }).eq('id', pending.id).eq('status', 'sending');
        return res.status(409).json({ success: false, message: 'O controlo humano já não está ativo nesta conversa.' });
      }
      await sendEvolutionText(conversation.contact_phone, body);
      const { error: sentError } = await supabaseAdmin.from('whatsapp_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', pending.id).eq('status', 'sending');
      if (sentError) throw new Error('MESSAGE_STATUS_UPDATE_FAILED');
      await supabaseAdmin.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);
      return res.json({ success: true, messageId: pending.id });
    } catch {
      await supabaseAdmin.from('whatsapp_messages')
        .update({ status: 'unknown' }).eq('id', pending.id).eq('status', 'sending');
      return res.status(502).json({ success: false, delivery: 'unknown', message: 'O envio foi iniciado mas não foi possível confirmar o resultado. Não repita automaticamente; verifique a conversa no WhatsApp.' });
    }
  } catch {
    console.error('[WhatsApp Admin] Falha no envio manual.');
    return res.status(503).json({ success: false, message: 'Não foi possível enviar a mensagem.' });
  }
});

export default router;
