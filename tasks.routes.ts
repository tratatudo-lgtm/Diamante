import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';

const router = Router();
router.use(verifyAuth);
const user = (req: AuthenticatedRequest) => req.authenticatedUser!;
const isAdmin = (req: AuthenticatedRequest) => user(req).role === 'admin';
const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });
const statuses = new Set(['por_fazer', 'em_curso', 'bloqueada', 'concluida']);
const priorities = new Set(['baixa', 'normal', 'alta', 'urgente']);

async function notify(employeeId: string, taskId: string, kind: 'task_assigned' | 'task_updated', title: string, body: string) {
  const { error } = await supabaseAdmin.from('collab_notifications').insert({
    funcionario_id: employeeId, kind, entity_id: taskId, title, body,
  });
  if (error) console.error('[Tasks] Não foi possível persistir a notificação.');
  else (globalThis as any).io?.to(employeeId).emit('notification:new', { kind, entity_id: taskId, title, body });
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const employee = user(req);
  const tasks: any[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabaseAdmin.from('operational_tasks')
      .select('id,title,description,status,priority,assigned_to,created_by,loja_id,due_at,completed_at,created_at,updated_at,assignee:funcionarios!operational_tasks_assigned_to_fkey(id,nome_completo,role,loja_id),creator:funcionarios!operational_tasks_created_by_fkey(id,nome_completo),lojas(nome)')
      .order('status').order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
      .range(offset, offset + 499);
    if (!isAdmin(req)) query = query.eq('assigned_to', employee.id);
    if (typeof req.query.status === 'string' && statuses.has(req.query.status)) query = query.eq('status', req.query.status);
    if (isAdmin(req) && typeof req.query.loja_id === 'string') query = query.eq('loja_id', req.query.loja_id);
    const { data, error } = await query;
    if (error) return fail(res, 503, 'Não foi possível carregar todas as tarefas.');
    tasks.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return res.json({ success: true, tasks });
});

router.get('/:id/events', async (req: AuthenticatedRequest, res: Response) => {
  let taskQuery = supabaseAdmin.from('operational_tasks').select('id,assigned_to');
  if (!isAdmin(req)) taskQuery = taskQuery.eq('assigned_to', user(req).id);
  const { data: task, error: taskError } = await taskQuery.eq('id', req.params.id).maybeSingle();
  if (taskError) return fail(res, 503, 'Não foi possível validar a tarefa.');
  if (!task) return fail(res, 404, 'Tarefa não encontrada.');
  const events: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('operational_task_events')
      .select('id,action,old_values,new_values,created_at,funcionarios!operational_task_events_actor_id_fkey(nome_completo)')
      .eq('task_id', req.params.id).order('created_at', { ascending: false }).range(offset, offset + 499);
    if (error) return fail(res, 503, 'Não foi possível carregar todo o histórico.');
    events.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return res.json({ success: true, events });
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!isAdmin(req)) return fail(res, 403, 'Apenas administradores podem criar e atribuir tarefas.');
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const assignedTo = typeof req.body?.assigned_to === 'string' ? req.body.assigned_to : '';
  const priority = typeof req.body?.priority === 'string' ? req.body.priority : 'normal';
  const dueAt = req.body?.due_at ? new Date(req.body.due_at) : null;
  if (title.length < 5 || title.length > 160 || description.length > 6000 || !assignedTo || !priorities.has(priority)) {
    return fail(res, 400, 'Verifique o título, a descrição, o responsável e a prioridade.');
  }
  if (req.body?.due_at && (!dueAt || Number.isNaN(dueAt.getTime()))) return fail(res, 400, 'Prazo inválido.');
  const { data: assignee, error: assigneeError } = await supabaseAdmin.from('funcionarios')
    .select('id,loja_id,nome_completo').eq('id', assignedTo).eq('ativo', true).maybeSingle();
  if (assigneeError) return fail(res, 503, 'Não foi possível validar o responsável.');
  if (!assignee) return fail(res, 400, 'O responsável não existe ou não está activo.');
  const lojaId = req.body?.loja_id ?? assignee.loja_id;
  if (lojaId && assignee.loja_id && lojaId !== assignee.loja_id) return fail(res, 400, 'A loja da tarefa tem de corresponder à loja do responsável.');
  const { data: taskData, error } = await supabaseAdmin.rpc('create_operational_task_with_event', {
    p_title: title, p_description: description, p_assigned_to: assignedTo,
    p_created_by: user(req).id, p_loja_id: lojaId || null,
    p_priority: priority, p_due_at: dueAt?.toISOString() || null,
  });
  const task = taskData as any;
  if (error || !task?.id) {
    if (error?.code === '42501') return fail(res, 403, 'Não está autorizado a criar esta tarefa.');
    if (error?.code === '22023') return fail(res, 400, 'O responsável ou a loja da tarefa já não são válidos.');
    return fail(res, 503, 'Não foi possível criar a tarefa e registar o histórico.');
  }
  await notify(assignedTo, task.id, 'task_assigned', 'Nova tarefa atribuída', title);
  (globalThis as any).io?.to('admin').emit('task:created', { id: task.id, loja_id: task.loja_id });
  return res.status(201).json({ success: true, task });
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const actor = user(req);
  const { data: current, error: readError } = await supabaseAdmin.from('operational_tasks')
    .select('*').eq('id', req.params.id).maybeSingle();
  if (readError) return fail(res, 503, 'Não foi possível carregar a tarefa.');
  if (!current) return fail(res, 404, 'Tarefa não encontrada.');
  const admin = isAdmin(req);
  if (!admin && current.assigned_to !== actor.id) return fail(res, 404, 'Tarefa não encontrada.');
  const update: Record<string, unknown> = {};
  if (admin) {
    if (typeof req.body?.title === 'string') {
      const title = req.body.title.trim();
      if (title.length < 5 || title.length > 160) return fail(res, 400, 'O título deve ter entre 5 e 160 caracteres.');
      update.title = title;
    }
    if (typeof req.body?.description === 'string') {
      if (req.body.description.length > 6000) return fail(res, 400, 'A descrição excede o limite permitido.');
      update.description = req.body.description.trim();
    }
    if (typeof req.body?.priority === 'string') {
      if (!priorities.has(req.body.priority)) return fail(res, 400, 'Prioridade inválida.');
      update.priority = req.body.priority;
    }
    if (typeof req.body?.assigned_to === 'string' && req.body.assigned_to !== current.assigned_to) {
      const { data: assignee, error } = await supabaseAdmin.from('funcionarios').select('id,loja_id')
        .eq('id', req.body.assigned_to).eq('ativo', true).maybeSingle();
      if (error) return fail(res, 503, 'Não foi possível validar o responsável.');
      if (!assignee) return fail(res, 400, 'O novo responsável não existe ou não está activo.');
      update.assigned_to = assignee.id;
      update.loja_id = assignee.loja_id;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'due_at')) {
      if (req.body.due_at === null || req.body.due_at === '') update.due_at = null;
      else {
        const date = new Date(req.body.due_at);
        if (Number.isNaN(date.getTime())) return fail(res, 400, 'Prazo inválido.');
        update.due_at = date.toISOString();
      }
    }
    if (typeof req.body?.status === 'string') {
      if (!statuses.has(req.body.status)) return fail(res, 400, 'Estado inválido.');
      update.status = req.body.status;
    }
  } else {
    if (typeof req.body?.status !== 'string' || !['por_fazer','em_curso','concluida'].includes(req.body.status)) {
      return fail(res, 403, 'Só pode actualizar o estado da tarefa que lhe foi atribuída.');
    }
    update.status = req.body.status;
  }
  if (!Object.keys(update).length) return fail(res, 400, 'Não foram indicadas alterações válidas.');
  const { data: updatedData, error: updateError } = await supabaseAdmin.rpc('update_operational_task_with_event', {
    p_task_id: current.id, p_actor_id: actor.id,
    p_expected_updated_at: current.updated_at, p_changes: update,
  });
  const updated = updatedData as any;
  if (updateError) {
    if (updateError.code === 'P0002') return fail(res, 404, 'Tarefa não encontrada.');
    if (updateError.code === '40001') return fail(res, 409, 'A tarefa foi alterada por outro utilizador. Actualize a página.');
    if (updateError.code === '42501') return fail(res, 403, 'Não está autorizado a actualizar esta tarefa.');
    if (updateError.code === '22023') return fail(res, 400, 'Os dados da tarefa são inválidos.');
    return fail(res, 503, 'Não foi possível actualizar a tarefa e guardar o histórico.');
  }
  if (!updated?.id) return fail(res, 503, 'Não foi possível confirmar a actualização da tarefa.');
  if (updated.assigned_to !== current.assigned_to) {
    await notify(updated.assigned_to, current.id, 'task_assigned', 'Tarefa atribuída', updated.title);
    (globalThis as any).io?.to(current.assigned_to).emit('task:updated', { id: current.id });
  } else if (current.assigned_to !== actor.id) {
    await notify(current.assigned_to, current.id, 'task_updated', 'Tarefa actualizada', updated.title);
    (globalThis as any).io?.to(current.assigned_to).emit('task:updated', { id: current.id });
  }
  (globalThis as any).io?.to('admin').emit('task:updated', { id: current.id });
  return res.json({ success: true, task: updated });
});

export default router;
