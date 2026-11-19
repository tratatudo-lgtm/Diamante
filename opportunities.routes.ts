import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin, AdminRequest } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);
const actor = (req: AdminRequest) => req.adminUser!;
const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });
const stages = new Set(['lead','contactado','qualificacao','proposta','negociacao','ganha','perdida']);
const types = new Set(['parceria','investidor','nova_loja','fornecedor','outro']);
const priorities = new Set(['baixa','normal','alta','urgente']);
const allowedFields = ['title','opportunity_type','stage','priority','expected_value','location','contact_name','contact_email','contact_phone','assigned_to','next_action','next_action_at','notes'] as const;

async function notify(employeeId: string, id: string, kind: 'opportunity_assigned'|'opportunity_updated', title: string, body: string) {
  const { error } = await supabaseAdmin.from('collab_notifications').insert({ funcionario_id:employeeId,kind,entity_id:id,title,body });
  if (!error) (globalThis as any).io?.to(employeeId).emit('notification:new',{kind,entity_id:id,title,body});
}

router.get('/directory', async (_req: AdminRequest,res: Response) => {
  const [{data:employees,error:e1},{data:stores,error:e2}] = await Promise.all([
    supabaseAdmin.from('funcionarios').select('id,nome_completo,loja_id,lojas(nome)').eq('ativo',true).order('nome_completo').limit(500),
    supabaseAdmin.from('lojas').select('id,nome').eq('ativo',true).order('nome').limit(300),
  ]);
  if(e1||e2)return fail(res,503,'Não foi possível carregar responsáveis e lojas.');
  return res.json({success:true,employees:employees||[],stores:stores||[]});
});

router.get('/', async (_req: AdminRequest,res: Response) => {
  const opportunities: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const {data,error}=await supabaseAdmin.from('crm_opportunities')
      .select('id,title,opportunity_type,stage,priority,expected_value,location,contact_name,contact_email,contact_phone,assigned_to,next_action,next_action_at,notes,created_by,created_at,updated_at,closed_at,assignee:funcionarios!crm_opportunities_assigned_to_fkey(id,nome_completo,loja_id),creator:funcionarios!crm_opportunities_created_by_fkey(id,nome_completo)')
      .order('updated_at',{ascending:false}).range(offset,offset+499);
    if(error)return fail(res,503,'Não foi possível carregar todas as oportunidades comerciais.');
    opportunities.push(...(data||[]));
    if(!data||data.length<500)break;
  }
  return res.json({success:true,opportunities});
});

router.get('/:id/events', async (req: AdminRequest,res: Response) => {
  const {data:opportunity,error:readError}=await supabaseAdmin.from('crm_opportunities').select('id').eq('id',req.params.id).maybeSingle();
  if(readError)return fail(res,503,'Não foi possível validar a oportunidade.');
  if(!opportunity)return fail(res,404,'Oportunidade não encontrada.');
  const events:any[]=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await supabaseAdmin.from('crm_opportunity_events')
      .select('id,action,old_values,new_values,created_at,actor:funcionarios!crm_opportunity_events_actor_id_fkey(nome_completo)')
      .eq('opportunity_id',req.params.id).order('created_at',{ascending:false}).range(offset,offset+499);
    if(error)return fail(res,503,'Não foi possível carregar todo o histórico.');
    events.push(...(data||[]));
    if(!data||data.length<500)break;
  }
  return res.json({success:true,events});
});

router.post('/', async (req: AdminRequest,res: Response) => {
  const body=req.body||{};
  const title=typeof body.title==='string'?body.title.trim():'';
  if(title.length<3||title.length>180||!types.has(body.opportunity_type)||!stages.has(body.stage||'lead')||!priorities.has(body.priority||'normal'))return fail(res,400,'Verifique o título, tipo, fase e prioridade.');
  const value=body.expected_value===null||body.expected_value===''||body.expected_value===undefined?null:Number(body.expected_value);
  if(value!==null&&(!Number.isFinite(value)||value<0))return fail(res,400,'O valor previsto tem de ser um número positivo.');
  const assigned=typeof body.assigned_to==='string'&&body.assigned_to?body.assigned_to:null;
  if(assigned){const {data,error}=await supabaseAdmin.from('funcionarios').select('id').eq('id',assigned).eq('ativo',true).maybeSingle();if(error)return fail(res,503,'Não foi possível validar o responsável.');if(!data)return fail(res,400,'O responsável seleccionado não existe ou não está activo.');}
  const nextAt=body.next_action_at?new Date(body.next_action_at):null;
  if(body.next_action_at&&(!nextAt||Number.isNaN(nextAt.getTime())))return fail(res,400,'A data da próxima acção é inválida.');
  const row={
    title,opportunity_type:body.opportunity_type,stage:body.stage||'lead',priority:body.priority||'normal',expected_value:value,
    location:typeof body.location==='string'?body.location.trim()||null:null,
    contact_name:typeof body.contact_name==='string'?body.contact_name.trim()||null:null,
    contact_email:typeof body.contact_email==='string'?body.contact_email.trim().toLowerCase()||null:null,
    contact_phone:typeof body.contact_phone==='string'?body.contact_phone.trim()||null:null,
    assigned_to:assigned,next_action:typeof body.next_action==='string'?body.next_action.trim()||null:null,
    next_action_at:nextAt?.toISOString()||null,notes:typeof body.notes==='string'?body.notes.trim():'',
    created_by:actor(req).id,closed_at:['ganha','perdida'].includes(body.stage)?new Date().toISOString():null,
  };
  if((row.contact_email&&row.contact_email.length>254)||(row.location&&row.location.length>240)||(row.contact_name&&row.contact_name.length>160)||(row.contact_phone&&row.contact_phone.length>40)||(row.notes.length>8000)||(row.next_action&&row.next_action.length>1000))return fail(res,400,'Um dos campos excede o limite permitido.');
  const {data,error}=await supabaseAdmin.rpc('create_crm_opportunity_with_event',{
    p_actor_id:actor(req).id,
    p_payload:row,
  });
  if(error||!data)return fail(res,error?.code==='42501'?403:400,'Não foi possível criar a oportunidade e o respectivo histórico.');

  if(assigned)await notify(assigned,data.id,'opportunity_assigned','Nova oportunidade atribuída',title);
  (globalThis as any).io?.to('admin').emit('opportunity:created',{id:data.id});
  return res.status(201).json({success:true,opportunity:data});
});

router.patch('/:id', async (req: AdminRequest,res: Response) => {
  const {data:current,error:readError}=await supabaseAdmin.from('crm_opportunities').select('*').eq('id',req.params.id).maybeSingle();
  if(readError)return fail(res,503,'Não foi possível carregar a oportunidade.');
  if(!current)return fail(res,404,'Oportunidade não encontrada.');
  const body=req.body||{};
  const expectedUpdatedAt=body.expected_updated_at;
  if(typeof expectedUpdatedAt!=='string'||Number.isNaN(Date.parse(expectedUpdatedAt)))return fail(res,400,'Versão da oportunidade em falta ou inválida. Actualize a lista.');
  const update:Record<string,unknown>={};
  for(const field of allowedFields){
    if(!(field in body))continue;
    const value=body[field];
    if(field==='title'){if(typeof value!=='string'||value.trim().length<3||value.trim().length>180)return fail(res,400,'O título deve ter entre 3 e 180 caracteres.');update.title=value.trim();}
    else if(field==='opportunity_type'){if(!types.has(value))return fail(res,400,'Tipo de oportunidade inválido.');update.opportunity_type=value;}
    else if(field==='stage'){if(!stages.has(value))return fail(res,400,'Fase inválida.');update.stage=value;}
    else if(field==='priority'){if(!priorities.has(value))return fail(res,400,'Prioridade inválida.');update.priority=value;}
    else if(field==='expected_value'){const n=value===null||value===''?null:Number(value);if(n!==null&&(!Number.isFinite(n)||n<0))return fail(res,400,'Valor previsto inválido.');update.expected_value=n;}
    else if(field==='assigned_to'){if(value===null||value==='')update.assigned_to=null;else{if(typeof value!=='string')return fail(res,400,'Responsável inválido.');const {data,error}=await supabaseAdmin.from('funcionarios').select('id').eq('id',value).eq('ativo',true).maybeSingle();if(error)return fail(res,503,'Não foi possível validar o responsável.');if(!data)return fail(res,400,'O responsável não existe ou não está activo.');update.assigned_to=data.id;}}
    else if(field==='next_action_at'){if(value===null||value==='')update.next_action_at=null;else{const d=new Date(value);if(Number.isNaN(d.getTime()))return fail(res,400,'Data da próxima acção inválida.');update.next_action_at=d.toISOString();}}
    else if(['location','contact_name','contact_email','contact_phone','next_action','notes'].includes(field)){if(value!==null&&typeof value!=='string')return fail(res,400,'Campo de texto inválido.');const v=typeof value==='string'?value.trim():null;const max:Record<string,number>={location:240,contact_name:160,contact_email:254,contact_phone:40,next_action:1000,notes:8000};if(v&&v.length>max[field])return fail(res,400,'Um dos campos excede o limite permitido.');update[field]=field==='contact_email'&&v?v.toLowerCase():v;}
  }
  if(!Object.keys(update).length)return fail(res,400,'Não foram fornecidas alterações.');
  const stage=String(update.stage??current.stage);
  if(['ganha','perdida'].includes(stage))update.closed_at=current.closed_at||new Date().toISOString();else if('stage'in update)update.closed_at=null;
  const {data:updated,error}=await supabaseAdmin.rpc('update_crm_opportunity_with_event',{
    p_id:current.id,
    p_actor_id:actor(req).id,
    p_expected_updated_at:expectedUpdatedAt,
    p_payload:update,
  });
  if(error||!updated){
    if(error?.code==='40001')return fail(res,409,'A oportunidade foi alterada por outro utilizador. Actualize os dados e tente novamente.');
    if(error?.code==='P0002')return fail(res,404,'Oportunidade não encontrada.');
    return fail(res,error?.code==='42501'?403:400,'Não foi possível actualizar a oportunidade e o respectivo histórico.');
  }
  const recipients=new Set<string>();if(typeof updated.assigned_to==='string')recipients.add(updated.assigned_to);if(typeof current.assigned_to==='string')recipients.add(current.assigned_to);
  for(const employeeId of recipients)await notify(employeeId,current.id,'opportunity_updated','Oportunidade actualizada',updated.title);
  (globalThis as any).io?.to('admin').emit('opportunity:updated',{id:current.id});
  return res.json({success:true,opportunity:updated});
});

export default router;
