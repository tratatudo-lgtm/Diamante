import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';

const router = Router();
router.use(verifyAuth);

const employee = (req: AuthenticatedRequest) => req.authenticatedUser!;
const isAdmin = (req: AuthenticatedRequest) => employee(req).role === 'admin';
const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });

async function isConversationMember(conversationId: string, employeeId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('collab_conversation_members')
    .select('id').eq('conversation_id', conversationId).eq('funcionario_id', employeeId).maybeSingle();
  return !error && Boolean(data);
}

async function canAccessReport(reportId: string, req: AuthenticatedRequest): Promise<boolean> {
  const user = employee(req);
  let query = supabaseAdmin.from('collab_reports').select('id, reporter_id, assigned_to');
  if (!isAdmin(req)) query = query.or('reporter_id.eq.' + user.id + ',assigned_to.eq.' + user.id);
  const { data, error } = await query.eq('id', reportId).maybeSingle();
  return !error && Boolean(data);
}

// Employee directory — only active staff fields required to start a conversation.
router.get('/directory', async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('funcionarios')
    .select('id, nome_completo, role, loja_id, lojas(nome)')
    .eq('ativo', true).order('nome_completo').limit(300);
  if (error) return fail(res, 503, 'Não foi possível carregar a equipa.');
  return res.json({ success: true, employees: (data || []).filter((item: any) => item.id !== employee(req).id) });
});

router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  const user = employee(req);
  const { data: memberships, error: memberError } = await supabaseAdmin.from('collab_conversation_members')
    .select('conversation_id, last_read_at, papel').eq('funcionario_id', user.id);
  if (memberError) return fail(res, 503, 'Não foi possível carregar as conversas.');
  const ids = (memberships || []).map((item: any) => item.conversation_id);
  if (!ids.length) return res.json({ success: true, conversations: [] });

  const [{ data: conversations, error }, { data: allMembers }] = await Promise.all([
    supabaseAdmin.from('collab_conversations').select('id, tipo, titulo, loja_id, criada_por, created_at, updated_at, last_message_at')
      .in('id', ids).order('last_message_at', { ascending: false }),
    supabaseAdmin.from('collab_conversation_members')
      .select('conversation_id, funcionario_id, papel, last_read_at, funcionarios(nome_completo, role, loja_id)')
      .in('conversation_id', ids),
  ]);
  if (error) return fail(res, 503, 'Não foi possível carregar as conversas.');
  const readAt = new Map((memberships || []).map((item: any) => [item.conversation_id, item.last_read_at]));
  const result = await Promise.all((conversations || []).map(async (conversation: any) => {
    const members = (allMembers || []).filter((item: any) => item.conversation_id === conversation.id);
    const lastRead = readAt.get(conversation.id) as string;
    const { count } = await supabaseAdmin.from('collab_messages').select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id).neq('sender_id', user.id).gt('created_at', lastRead || '1970-01-01T00:00:00Z');
    return { ...conversation, members, unread_count: count || 0 };
  }));
  return res.json({ success: true, conversations: result });
});

router.post('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  const user = employee(req);
  const type = req.body?.tipo === 'grupo' ? 'grupo' : 'directa';
  const title = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
  const requested = Array.isArray(req.body?.participants) ? req.body.participants : [];
  const participants = [...new Set([user.id, ...requested.filter((id: unknown) => typeof id === 'string')])];
  if (participants.length < 2 || participants.length > 50) return fail(res, 400, 'Seleccione entre 1 e 49 colegas.');
  if (type === 'directa' && participants.length !== 2) return fail(res, 400, 'Uma conversa privada só pode ter dois participantes.');
  if (type === 'grupo' && (title.length < 2 || title.length > 100)) return fail(res, 400, 'Indique um nome de grupo entre 2 e 100 caracteres.');

  const { data: active, error: activeError } = await supabaseAdmin.from('funcionarios')
    .select('id').in('id', participants).eq('ativo', true);
  if (activeError || (active || []).length !== participants.length) return fail(res, 400, 'Um ou mais participantes não estão activos.');

  if (type === 'directa') {
    const { data: ownMemberships } = await supabaseAdmin.from('collab_conversation_members')
      .select('conversation_id').eq('funcionario_id', user.id);
    const ids = (ownMemberships || []).map((item: any) => item.conversation_id);
    if (ids.length) {
      const { data: candidates } = await supabaseAdmin.from('collab_conversations')
        .select('id').in('id', ids).eq('tipo', 'directa');
      for (const candidate of candidates || []) {
        const { data: members } = await supabaseAdmin.from('collab_conversation_members')
          .select('funcionario_id').eq('conversation_id', candidate.id);
        const memberIds = (members || []).map((item: any) => item.funcionario_id).sort();
        if (memberIds.length === 2 && memberIds[0] === [...participants].sort()[0] && memberIds[1] === [...participants].sort()[1]) {
          return res.json({ success: true, conversationId: candidate.id, existing: true });
        }
      }
    }
  }

  const { data: conversation, error } = await supabaseAdmin.from('collab_conversations').insert({
    tipo: type, titulo: type === 'grupo' ? title : null, criada_por: user.id, loja_id: user.loja_id,
  }).select('id').single();
  if (error || !conversation) return fail(res, 503, 'Não foi possível criar a conversa.');
  const { error: membershipError } = await supabaseAdmin.from('collab_conversation_members').insert(
    participants.map((id: string) => ({ conversation_id: conversation.id, funcionario_id: id, papel: id === user.id ? 'criador' : 'membro' }))
  );
  if (membershipError) {
    await supabaseAdmin.from('collab_conversations').delete().eq('id', conversation.id);
    return fail(res, 503, 'Não foi possível adicionar os participantes.');
  }
  const io = (globalThis as any).io;
  for (const id of participants) io?.to(id).emit('chat:conversation', { conversationId: conversation.id });
  return res.status(201).json({ success: true, conversationId: conversation.id });
});

router.get('/conversations/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  if (!(await isConversationMember(id, employee(req).id))) return fail(res, 404, 'Conversa não encontrada.');
  const limitRaw = Number(req.query.limit || 80);
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(limitRaw, 150)) : 80;
  const { data, error } = await supabaseAdmin.from('collab_messages')
    .select('id, conversation_id, sender_id, body, created_at, funcionarios(nome_completo, role)')
    .eq('conversation_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
  if (error) return fail(res, 503, 'Não foi possível carregar as mensagens.');
  await supabaseAdmin.from('collab_conversation_members').update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', id).eq('funcionario_id', employee(req).id);
  return res.json({ success: true, messages: (data || []).reverse() });
});

router.post('/conversations/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 4000) return fail(res, 400, 'A mensagem deve ter entre 1 e 4.000 caracteres.');
  if (!(await isConversationMember(id, employee(req).id))) return fail(res, 404, 'Conversa não encontrada.');
  const { data, error } = await supabaseAdmin.from('collab_messages').insert({
    conversation_id: id, sender_id: employee(req).id, body,
  }).select('id, conversation_id, sender_id, body, created_at, funcionarios(nome_completo, role)').single();
  if (error || !data) return fail(res, 503, 'Não foi possível enviar a mensagem.');
  await supabaseAdmin.from('collab_conversations').update({ last_message_at: data.created_at, updated_at: data.created_at }).eq('id', id);
  const { data: recipients } = await supabaseAdmin.from('collab_conversation_members')
    .select('funcionario_id').eq('conversation_id', id);
  const io = (globalThis as any).io;
  for (const recipient of recipients || []) {
    io?.to(recipient.funcionario_id).emit('chat:message', data);
  }
  return res.status(201).json({ success: true, message: data });
});

router.post('/reports', async (req: AuthenticatedRequest, res: Response) => {
  const user = employee(req);
  const title = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
  const description = typeof req.body?.descricao === 'string' ? req.body.descricao.trim() : '';
  const categories = ['sistema', 'equipamento', 'caixa', 'inventario', 'operacao', 'seguranca', 'sugestao', 'outro'];
  const priorities = ['baixa', 'normal', 'alta', 'urgente'];
  const category = categories.includes(req.body?.categoria) ? req.body.categoria : 'outro';
  const priority = priorities.includes(req.body?.prioridade) ? req.body.prioridade : 'normal';
  if (title.length < 5 || title.length > 140 || description.length < 10 || description.length > 8000) {
    return fail(res, 400, 'Indique um título (5–140 caracteres) e uma descrição (10–8.000 caracteres).');
  }
  const { data, error } = await supabaseAdmin.from('collab_reports').insert({
    titulo: title, descricao: description, categoria: category, prioridade: priority,
    reporter_id: user.id, loja_id: user.loja_id,
  }).select('id, reference, titulo, descricao, categoria, prioridade, estado, reporter_id, loja_id, assigned_to, created_at, updated_at').single();
  if (error || !data) return fail(res, 503, 'Não foi possível registar a ocorrência.');
  const io = (globalThis as any).io;
  io?.to('admin').emit('report:created', { id: data.id, reference: data.reference, prioridade: data.prioridade });
  if (user.loja_id) io?.to('store:' + user.loja_id).emit('report:created', { id: data.id, reference: data.reference });
  return res.status(201).json({ success: true, report: data });
});

router.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  const user = employee(req);
  let query = supabaseAdmin.from('collab_reports')
    .select('id, reference, titulo, descricao, categoria, prioridade, estado, reporter_id, loja_id, assigned_to, created_at, updated_at, resolved_at, funcionarios!collab_reports_reporter_id_fkey(nome_completo, role, loja_id)', { count: 'exact' });
  if (!isAdmin(req)) query = query.or('reporter_id.eq.' + user.id + ',assigned_to.eq.' + user.id);
  const { data, error, count } = await query.order('created_at', { ascending: false }).limit(150);
  if (error) return fail(res, 503, 'Não foi possível carregar as ocorrências.');
  return res.json({ success: true, reports: data || [], total: count || 0 });
});

router.get('/reports/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!(await canAccessReport(req.params.id, req))) return fail(res, 404, 'Ocorrência não encontrada.');
  const [{ data: report, error }, { data: comments, error: commentsError }] = await Promise.all([
    supabaseAdmin.from('collab_reports').select('*, funcionarios!collab_reports_reporter_id_fkey(nome_completo, role)').eq('id', req.params.id).single(),
    supabaseAdmin.from('collab_report_comments').select('id, funcionario_id, comentario, interno, created_at, funcionarios(nome_completo, role)')
      .eq('report_id', req.params.id).eq('interno', false).order('created_at'),
  ]);
  if (error || commentsError) return fail(res, 503, 'Não foi possível carregar os detalhes da ocorrência.');
  return res.json({ success: true, report, comments: comments || [] });
});

router.post('/reports/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  const comment = typeof req.body?.comentario === 'string' ? req.body.comentario.trim() : '';
  if (!comment || comment.length > 4000) return fail(res, 400, 'O comentário deve ter entre 1 e 4.000 caracteres.');
  if (!(await canAccessReport(req.params.id, req))) return fail(res, 404, 'Ocorrência não encontrada.');
  const { data, error } = await supabaseAdmin.from('collab_report_comments').insert({
    report_id: req.params.id, funcionario_id: employee(req).id, comentario: comment, interno: false,
  }).select('id, funcionario_id, comentario, created_at, funcionarios(nome_completo, role)').single();
  if (error || !data) return fail(res, 503, 'Não foi possível adicionar o comentário.');
  const { data: report } = await supabaseAdmin.from('collab_reports').select('reporter_id, assigned_to').eq('id', req.params.id).single();
  const io = (globalThis as any).io;
  if (report) {
    io?.to(report.reporter_id).emit('report:updated', { id: req.params.id });
    if (report.assigned_to) io?.to(report.assigned_to).emit('report:updated', { id: req.params.id });
    io?.to('admin').emit('report:updated', { id: req.params.id });
  }
  return res.status(201).json({ success: true, comment: data });
});

router.patch('/reports/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!isAdmin(req)) return fail(res, 403, 'Apenas administradores podem alterar o estado ou atribuir ocorrências.');
  const statuses = ['novo', 'em_analise', 'em_resolucao', 'aguarda_informacao', 'resolvido', 'fechado'];
  const priorities = ['baixa', 'normal', 'alta', 'urgente'];
  const update: Record<string, any> = {};
  if (typeof req.body?.estado === 'string' && statuses.includes(req.body.estado)) update.estado = req.body.estado;
  if (typeof req.body?.prioridade === 'string' && priorities.includes(req.body.prioridade)) update.prioridade = req.body.prioridade;
  if (req.body?.assigned_to === null || typeof req.body?.assigned_to === 'string') update.assigned_to = req.body.assigned_to;
  if (!Object.keys(update).length) return fail(res, 400, 'Nenhuma alteração válida indicada.');
  update.updated_at = new Date().toISOString();
  if (update.estado === 'resolvido' || update.estado === 'fechado') update.resolved_at = new Date().toISOString();
  else if (update.estado) update.resolved_at = null;
  const { data, error } = await supabaseAdmin.from('collab_reports').update(update).eq('id', req.params.id)
    .select('id, reference, estado, prioridade, assigned_to, reporter_id').maybeSingle();
  if (error) return fail(res, 503, 'Não foi possível actualizar a ocorrência.');
  if (!data) return fail(res, 404, 'Ocorrência não encontrada.');
  const io = (globalThis as any).io;
  io?.to(data.reporter_id).emit('report:updated', { id: data.id, estado: data.estado });
  if (data.assigned_to) io?.to(data.assigned_to).emit('report:updated', { id: data.id, estado: data.estado });
  io?.to('admin').emit('report:updated', { id: data.id, estado: data.estado });
  return res.json({ success: true, report: data });
});

export default router;
