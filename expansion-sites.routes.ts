import { Router, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin, AdminRequest } from './middleware/verifyAdmin';

const router=Router();router.use(verifyAdmin);
const actor=(req:AdminRequest)=>req.adminUser!;
const fail=(res:Response,status:number,message:string)=>res.status(status).json({success:false,message});
const statuses=new Set(['em_avaliacao','visita_pendente','em_negociacao','aprovado','rejeitado','arquivado']);
const scoreFields=['footfall_score','visibility_score','accessibility_score','competition_score','security_score','parking_score','fit_score'] as const;
const textLimits:Record<string,number>={name:180,address:300,city:120,district:120,notes:8000};

async function validateOpportunity(id:unknown){
 if(id===null||id===undefined||id==='')return {value:null,error:null};
 if(typeof id!=='string')return {value:null,error:'Oportunidade associada inválida.'};
 const {data,error}=await supabaseAdmin.from('crm_opportunities').select('id').eq('id',id).maybeSingle();
 return {value:data?.id??null,error:error?'Não foi possível validar a oportunidade.':!data?'A oportunidade associada não existe.':null};
}
function numeric(value:unknown,min:number,max:number){if(value===null||value===''||value===undefined)return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:undefined;}

router.get('/',async(_req:AdminRequest,res:Response)=>{
 const {data,error}=await supabaseAdmin.from('crm_expansion_sites')
 .select('*,opportunity:crm_opportunities!crm_expansion_sites_opportunity_id_fkey(id,title,stage,expected_value),creator:funcionarios!crm_expansion_sites_created_by_fkey(id,nome_completo)')
 .order('weighted_score',{ascending:false}).limit(1000);
 if(error)return fail(res,503,'Não foi possível carregar os estudos de localização.');
 return res.json({success:true,sites:data||[]});
});
router.get('/:id/events',async(req:AdminRequest,res:Response)=>{
 const {data:site,error:siteError}=await supabaseAdmin.from('crm_expansion_sites').select('id').eq('id',req.params.id).maybeSingle();
 if(siteError)return fail(res,503,'Não foi possível validar a localização.');
 if(!site)return fail(res,404,'Estudo de localização não encontrado.');
 const {data,error}=await supabaseAdmin.from('crm_expansion_site_events').select('id,action,old_values,new_values,created_at,actor:funcionarios!crm_expansion_site_events_actor_id_fkey(nome_completo)').eq('site_id',req.params.id).order('created_at',{ascending:false}).limit(150);
 if(error)return fail(res,503,'Não foi possível carregar o histórico.');
 return res.json({success:true,events:data||[]});
});
router.post('/',async(req:AdminRequest,res:Response)=>{
 const b=req.body||{};const row:Record<string,unknown>={};
 for(const f of ['name','address','city'] as const){if(typeof b[f]!=='string'||b[f].trim().length<(f==='name'?3:2)||b[f].trim().length>textLimits[f])return fail(res,400,'Preencha correctamente o nome, morada e cidade.');row[f]=b[f].trim();}
 for(const f of ['district','notes'] as const){if(b[f]!==undefined&&b[f]!==null&&typeof b[f]!=='string')return fail(res,400,'Campo de texto inválido.');const v=typeof b[f]==='string'?b[f].trim():'';if(v.length>textLimits[f])return fail(res,400,'Um dos campos excede o limite permitido.');row[f]=v||null;if(f==='notes'&&!v)row[f]='';}
 for(const f of ['latitude','longitude','area_sqm','monthly_rent','estimated_setup_cost','estimated_monthly_revenue','estimated_monthly_other_costs','estimated_initial_stock','estimated_monthly_staff_cost','estimated_monthly_utilities_cost'] as const){const range=f==='latitude'?[-90,90]:f==='longitude'?[-180,180]:[0,1000000000];const v=numeric(b[f],range[0],range[1]);if(v===undefined)return fail(res,400,'Um dos valores numéricos é inválido.');row[f]=v;}
 for(const f of scoreFields){const v=Number(b[f]??3);if(!Number.isInteger(v)||v<1||v>5)return fail(res,400,'As classificações devem estar entre 1 e 5.');row[f]=v;}
 const status=b.status??'em_avaliacao';if(!statuses.has(status))return fail(res,400,'Estado do estudo inválido.');row.status=status;
 const link=await validateOpportunity(b.opportunity_id);if(link.error)return fail(res,400,link.error);row.opportunity_id=link.value;row.created_by=actor(req).id;
 const {data,error}=await supabaseAdmin.rpc('create_crm_expansion_site_with_event',{
  p_actor_id:actor(req).id,
  p_payload:row,
 });
 if(error||!data)return fail(res,error?.code==='42501'?403:400,'Não foi possível registar o estudo e o respectivo histórico.');
 (globalThis as any).io?.to('admin').emit('expansion-site:created',{id:data.id});
 return res.status(201).json({success:true,site:data});
});
router.patch('/:id',async(req:AdminRequest,res:Response)=>{
 const {data:current,error:readError}=await supabaseAdmin.from('crm_expansion_sites').select('*').eq('id',req.params.id).maybeSingle();
 if(readError)return fail(res,503,'Não foi possível carregar o estudo.');if(!current)return fail(res,404,'Estudo de localização não encontrado.');
 const b=req.body||{};const update:Record<string,unknown>={};
 for(const f of ['name','address','city','district','notes'] as const)if(f in b){if(b[f]!==null&&typeof b[f]!=='string')return fail(res,400,'Campo de texto inválido.');const v=typeof b[f]==='string'?b[f].trim():null;if(v!==null&&v.length>(textLimits[f]??300))return fail(res,400,'Um dos campos excede o limite permitido.');if(['name','address','city'].includes(f)&&(!v||v.length<(f==='name'?3:2)))return fail(res,400,'Nome, morada e cidade são obrigatórios.');update[f]=v??(f==='notes'?'':null);}
 for(const f of ['latitude','longitude','area_sqm','monthly_rent','estimated_setup_cost','estimated_monthly_revenue','estimated_monthly_other_costs','estimated_initial_stock','estimated_monthly_staff_cost','estimated_monthly_utilities_cost'] as const)if(f in b){const range=f==='latitude'?[-90,90]:f==='longitude'?[-180,180]:[0,1000000000];const v=numeric(b[f],range[0],range[1]);if(v===undefined)return fail(res,400,'Um dos valores numéricos é inválido.');update[f]=v;}
 for(const f of scoreFields)if(f in b){const v=Number(b[f]);if(!Number.isInteger(v)||v<1||v>5)return fail(res,400,'As classificações devem estar entre 1 e 5.');update[f]=v;}
 if('status'in b){if(!statuses.has(b.status))return fail(res,400,'Estado do estudo inválido.');update.status=b.status;}
 if('opportunity_id'in b){const link=await validateOpportunity(b.opportunity_id);if(link.error)return fail(res,400,link.error);update.opportunity_id=link.value;}
 if(!Object.keys(update).length)return fail(res,400,'Não foram fornecidas alterações.');
 const {data,error}=await supabaseAdmin.rpc('update_crm_expansion_site_with_event',{
  p_id:current.id,
  p_actor_id:actor(req).id,
  p_expected_updated_at:current.updated_at,
  p_payload:update,
 });
 if(error||!data){
  if(error?.code==='40001')return fail(res,409,'O estudo foi alterado por outro utilizador. Actualize os dados e tente novamente.');
  if(error?.code==='P0002')return fail(res,404,'Estudo de localização não encontrado.');
  return fail(res,error?.code==='42501'?403:400,'Não foi possível actualizar o estudo e o respectivo histórico.');
 }
 (globalThis as any).io?.to('admin').emit('expansion-site:updated',{id:current.id});
 return res.json({success:true,site:data});
});
export default router;
