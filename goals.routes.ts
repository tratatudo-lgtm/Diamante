import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';

const router = Router();
router.use(verifyAuth);
const actor = (req: AuthenticatedRequest) => req.authenticatedUser!;
const admin = (req: AuthenticatedRequest) => actor(req).role === 'admin';
const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });
const metrics = new Set(['transacoes_aprovadas','volume_aprovado','peso_aprovado_g']);
const statuses = new Set(['activa','suspensa','concluida']);

async function notify(employeeId: string, goalId: string, kind: 'goal_assigned'|'goal_updated', title: string, body: string) {
  const { error } = await supabaseAdmin.from('collab_notifications').insert({
    funcionario_id: employeeId, kind, entity_id: goalId, title, body,
  });
  if (error) { console.error('[Goals] Falha ao guardar notificação.'); return; }
  (globalThis as any).io?.to(employeeId).emit('notification:new', { kind, entity_id: goalId, title, body });
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
}

function lisbonMidnightUtc(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const approximate = new Date(Date.UTC(year, month - 1, day, 12));
  const zone = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Lisbon', timeZoneName: 'shortOffset' })
    .formatToParts(approximate).find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  const match = zone.match(/^GMT([+-])(\\d{1,2})(?::(\\d{2}))?$/);
  const offset = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  return new Date(Date.UTC(year, month - 1, day) - offset * 60_000).toISOString();
}

async function goalProgress(goal: any) {
  const [year, month, day] = String(goal.ends_on).split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const endDate = [nextDay.getUTCFullYear(), String(nextDay.getUTCMonth() + 1).padStart(2,'0'), String(nextDay.getUTCDate()).padStart(2,'0')].join('-');
  let query = supabaseAdmin.from('transacoes').select('id,valor_final,peso_gramas', { count: 'exact' })
    .eq('estado','aprovado').gte('created_at', lisbonMidnightUtc(goal.starts_on))
    .lt('created_at', lisbonMidnightUtc(endDate));
  if (goal.scope === 'loja') query = query.eq('loja_id', goal.loja_id);
  else query = query.eq('funcionario_id', goal.funcionario_id);
  const first = await query.range(0, 999);
  if (first.error || !first.data) throw new Error('Não foi possível calcular o progresso da meta.');
  if (goal.metric === 'transacoes_aprovadas') {
    const current = Number(first.count || 0);
    return { current, target: Number(goal.target_value), percentage: Math.min(100, Number((current / Number(goal.target_value) * 100).toFixed(1))), achieved: current >= Number(goal.target_value) };
  }
  let current = first.data.reduce((sum: number, row: any) => sum + Number(goal.metric === 'volume_aprovado' ? row.valor_final || 0 : row.peso_gramas || 0), 0);
  for (let offset = 1000; offset < (first.count || 0); offset += 1000) {
    const page = await query.range(offset, offset + 999);
    if (page.error || !page.data) throw new Error('Não foi possível calcular o progresso da meta.');
    current += page.data.reduce((sum: number, row: any) => sum + Number(goal.metric === 'volume_aprovado' ? row.valor_final || 0 : row.peso_gramas || 0), 0);
  }
  const safeCurrent = Number.isFinite(current) ? current : 0;
  return { current: Number(safeCurrent.toFixed(3)), target: Number(goal.target_value), percentage: Math.min(100, Number((safeCurrent / Number(goal.target_value) * 100).toFixed(1))), achieved: safeCurrent >= Number(goal.target_value) };
}

async function visibleGoal(goalId: string, req: AuthenticatedRequest) {
  let query = supabaseAdmin.from('operational_goals').select('*,lojas(nome),funcionarios!operational_goals_funcionario_id_fkey(id,nome_completo,loja_id)');
  if (!admin(req)) query = query.or('funcionario_id.eq.' + actor(req).id + (actor(req).loja_id ? ',loja_id.eq.' + actor(req).loja_id : ''));
  const { data, error } = await query.eq('id',goalId).maybeSingle();
  if (error) throw new Error('Não foi possível validar o acesso à meta.');
  return data;
}

router.get('/directory', async (req: AuthenticatedRequest, res: Response) => {
  if (!admin(req)) return fail(res,403,'Apenas administradores podem consultar os destinos dos objectivos.');
  const [{data:stores,error:storeError},{data:employees,error:employeeError}] = await Promise.all([
    supabaseAdmin.from('lojas').select('id,nome').eq('ativo',true).order('nome'),
    supabaseAdmin.from('funcionarios').select('id,nome_completo,loja_id,lojas(nome)').eq('ativo',true).order('nome_completo').limit(500),
  ]);
  if(storeError||employeeError)return fail(res,503,'Não foi possível carregar lojas e funcionários.');
  return res.json({success:true,stores:stores||[],employees:employees||[]});
});

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  let query = supabaseAdmin.from('operational_goals')
    .select('*,lojas(nome),funcionarios!operational_goals_funcionario_id_fkey(id,nome_completo,loja_id)')
    .order('ends_on',{ascending:true}).limit(200);
  if (!admin(req)) query = query.or('funcionario_id.eq.' + actor(req).id + (actor(req).loja_id ? ',loja_id.eq.' + actor(req).loja_id : ''));
  if (typeof req.query.status === 'string' && statuses.has(req.query.status)) query = query.eq('status',req.query.status);
  const { data, error } = await query;
  if (error) return fail(res,503,'Não foi possível carregar os objectivos.');
  const goals = await Promise.all((data || []).map(async (goal: any) => {
    try { return { ...goal, progress: await goalProgress(goal) }; }
    catch { return { ...goal, progress: null }; }
  }));
  return res.json({ success:true, goals });
});

router.get('/:id/events', async (req: AuthenticatedRequest, res: Response) => {
  let goal;
  try { goal = await visibleGoal(req.params.id,req); }
  catch { return fail(res,503,'Não foi possível validar o acesso ao objectivo.'); }
  if (!goal) return fail(res,404,'Objectivo não encontrado.');
  const { data,error } = await supabaseAdmin.from('operational_goal_events')
    .select('id,action,old_values,new_values,created_at,funcionarios!operational_goal_events_actor_id_fkey(nome_completo)')
    .eq('goal_id',goal.id).order('created_at',{ascending:false}).limit(100);
  if (error) return fail(res,503,'Não foi possível carregar o histórico.');
  return res.json({success:true,events:data || []});
});

router.post('/', async (req: AuthenticatedRequest,res: Response) => {
  if (!admin(req)) return fail(res,403,'Apenas administradores podem criar objectivos.');
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const scope = req.body?.scope;
  const metric = req.body?.metric;
  const target = Number(req.body?.target_value);
  const starts = req.body?.starts_on;
  const ends = req.body?.ends_on;
  if (title.length < 5 || title.length > 160 || description.length > 4000 || !['loja','funcionario'].includes(scope) || !metrics.has(metric) || !Number.isFinite(target) || target <= 0 || target > 1e12 || !validDate(starts) || !validDate(ends) || ends < starts) return fail(res,400,'Verifique os dados, a métrica, o valor e o período do objectivo.');
  let lojaId: string|null = null; let funcionarioId: string|null = null; let notifyId = '';
  if (scope === 'loja') {
    if (typeof req.body?.loja_id !== 'string') return fail(res,400,'Seleccione uma loja.');
    const { data,error } = await supabaseAdmin.from('lojas').select('id').eq('id',req.body.loja_id).eq('ativo',true).maybeSingle();
    if (error) return fail(res,503,'Não foi possível validar a loja.');
    if (!data) return fail(res,400,'A loja não existe ou não está activa.');
    lojaId = data.id;
  } else {
    if (typeof req.body?.funcionario_id !== 'string') return fail(res,400,'Seleccione um funcionário.');
    const { data,error } = await supabaseAdmin.from('funcionarios').select('id,loja_id').eq('id',req.body.funcionario_id).eq('ativo',true).maybeSingle();
    if (error) return fail(res,503,'Não foi possível validar o funcionário.');
    if (!data) return fail(res,400,'O funcionário não existe ou não está activo.');
    funcionarioId = data.id; notifyId = data.id;
  }
  const insert = { title,description,scope,metric,target_value:target,loja_id:lojaId,funcionario_id:funcionarioId,starts_on:starts,ends_on:ends,created_by:actor(req).id };
  const { data:goal,error } = await supabaseAdmin.from('operational_goals').insert(insert).select('*').single();
  if (error || !goal) return fail(res,503,'Não foi possível criar o objectivo.');
  const { error:eventError } = await supabaseAdmin.from('operational_goal_events').insert({goal_id:goal.id,actor_id:actor(req).id,action:'created',new_values:goal});
  if (eventError) { await supabaseAdmin.from('operational_goals').delete().eq('id',goal.id); return fail(res,503,'Não foi possível registar o histórico do objectivo.'); }
  if (notifyId) await notify(notifyId,goal.id,'goal_assigned','Novo objectivo atribuído',title);
  if (lojaId) {
    const {data:team} = await supabaseAdmin.from('funcionarios').select('id').eq('loja_id',lojaId).eq('ativo',true);
    for (const person of team || []) await notify(person.id,goal.id,'goal_assigned','Novo objectivo da loja',title);
    (globalThis as any).io?.to('store:'+lojaId).emit('goal:created',{id:goal.id,loja_id:lojaId});
  }
  (globalThis as any).io?.to('admin').emit('goal:created',{id:goal.id});
  return res.status(201).json({success:true,goal,progress:await goalProgress(goal)});
});

router.patch('/:id', async (req: AuthenticatedRequest,res: Response) => {
  if (!admin(req)) return fail(res,403,'Apenas administradores podem gerir objectivos.');
  const {data:current,error:readError}=await supabaseAdmin.from('operational_goals').select('*').eq('id',req.params.id).maybeSingle();
  if (readError) return fail(res,503,'Não foi possível carregar o objectivo.');
  if (!current) return fail(res,404,'Objectivo não encontrado.');
  const update:Record<string,unknown>={updated_at:new Date().toISOString()};
  if (typeof req.body?.title==='string') { const v=req.body.title.trim(); if(v.length<5||v.length>160)return fail(res,400,'Título inválido.'); update.title=v; }
  if (typeof req.body?.description==='string') { if(req.body.description.length>4000)return fail(res,400,'Descrição demasiado longa.'); update.description=req.body.description.trim(); }
  if (typeof req.body?.target_value!=='undefined') { const v=Number(req.body.target_value); if(!Number.isFinite(v)||v<=0||v>1e12)return fail(res,400,'Valor de objectivo inválido.'); update.target_value=v; }
  if (typeof req.body?.status==='string') { if(!statuses.has(req.body.status))return fail(res,400,'Estado inválido.'); update.status=req.body.status; }
  if (typeof req.body?.starts_on!=='undefined') { if(!validDate(req.body.starts_on))return fail(res,400,'Data inicial inválida.'); update.starts_on=req.body.starts_on; }
  if (typeof req.body?.ends_on!=='undefined') { if(!validDate(req.body.ends_on))return fail(res,400,'Data final inválida.'); update.ends_on=req.body.ends_on; }
  const nextStart=String(update.starts_on ?? current.starts_on); const nextEnd=String(update.ends_on ?? current.ends_on);
  if(nextEnd<nextStart)return fail(res,400,'A data final deve ser posterior à inicial.');
  if(Object.keys(update).length===1)return fail(res,400,'Não foram indicadas alterações.');
  const {data:updated,error}=await supabaseAdmin.from('operational_goals').update(update).eq('id',current.id).eq('updated_at',current.updated_at).select('*').maybeSingle();
  if(error)return fail(res,503,'Não foi possível actualizar o objectivo.');
  if(!updated)return fail(res,409,'O objectivo foi alterado por outro administrador. Actualize a página.');
  const action=update.status?'status_changed':'updated';
  const {error:eventError}=await supabaseAdmin.from('operational_goal_events').insert({goal_id:current.id,actor_id:actor(req).id,action,old_values:current,new_values:updated});
  if(eventError){await supabaseAdmin.from('operational_goals').update({title:current.title,description:current.description,target_value:current.target_value,status:current.status,starts_on:current.starts_on,ends_on:current.ends_on,updated_at:current.updated_at}).eq('id',current.id).eq('updated_at',updated.updated_at);return fail(res,503,'Não foi possível guardar o histórico. A alteração foi revertida.');}
  if(current.scope==='funcionario'&&current.funcionario_id)await notify(current.funcionario_id,current.id,'goal_updated','Objectivo actualizado',updated.title);
  if(current.scope==='loja'&&current.loja_id) {
    const {data:team}=await supabaseAdmin.from('funcionarios').select('id').eq('loja_id',current.loja_id).eq('ativo',true);
    for(const person of team||[]) await notify(person.id,current.id,'goal_updated','Objectivo da loja actualizado',updated.title);
    (globalThis as any).io?.to('store:'+current.loja_id).emit('goal:updated',{id:current.id,loja_id:current.loja_id});
  }
  (globalThis as any).io?.to('admin').emit('goal:updated',{id:current.id});
  return res.json({success:true,goal:updated,progress:await goalProgress(updated)});
});

export default router;
