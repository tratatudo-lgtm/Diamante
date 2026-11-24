import { Router, Response } from 'express';
import { verifyAuth, AuthenticatedRequest } from './middleware/verifyAuth';
import { supabaseAdmin } from './auth.service';
import { resolveStoreScope } from './store-scope';

const router = Router();
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function failure(res: Response, error: {code?: string}) {
 const status = error.code === '42501' ? 403 : error.code === '40001' ? 409 : 503;
 return res.status(status).json({success:false,message:status===409?'Os preços foram alterados. Atualize a cotação.':status===403?'Sem autorização.':'Não foi possível concluir a operação.'});
}
router.get('/prices',verifyAuth,async(req:AuthenticatedRequest,res:Response)=>{
 if(!req.authenticatedUser?.ativo) return res.sendStatus(403);
 const {data,error}=await supabaseAdmin.from('publicacoes_precos').select('id, publicado_em, publicacoes_precos_itens(qualidade_id, centimos_por_grama, qualidades_metal(metal,nome,toque,ativo))').order('publicado_em',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(error) return failure(res,error);
 return res.json({success:true,publicacao:data});
});
router.post('/prices',verifyAuth,async(req:AuthenticatedRequest,res:Response)=>{
 const actor=req.authenticatedUser;
 if(!actor?.ativo||actor.role!=='admin') return res.sendStatus(403);
 const {precos,publicacaoAnterior}=req.body||{};
 if(!Array.isArray(precos)||!precos.length||precos.length>1000||!(publicacaoAnterior===null||uuid(publicacaoAnterior))||precos.some(p=>!p||!uuid(p.qualidade_id)||!Number.isSafeInteger(p.centimos_por_grama)||p.centimos_por_grama<=0||p.centimos_por_grama>10000000)) return res.sendStatus(400);
 const {data,error}=await supabaseAdmin.rpc('publicar_precos_compra',{p_administrador_id:actor.id,p_precos:precos.map(p=>({qualidade_id:p.qualidade_id,centimos_por_grama:p.centimos_por_grama})),p_publicacao_anterior:publicacaoAnterior});
 if(error) return failure(res,error);
 return res.status(201).json({success:true,id:data});
});
router.post('/quotes',verifyAuth,async(req:AuthenticatedRequest,res:Response)=>{
 const actor=req.authenticatedUser;
 if(!actor?.ativo) return res.sendStatus(403);
 const {lojaId,clienteId,publicacaoId,pecas}=req.body||{};
 const scope=resolveStoreScope(actor,lojaId);
 if(!scope.ok) return res.status(scope.status).json({success:false,message:scope.message});
 if(!uuid(clienteId)||!uuid(publicacaoId)||!Array.isArray(pecas)||pecas.length<1||pecas.length>100||pecas.some(p=>!p||!uuid(p.qualidade_id)||!Number.isSafeInteger(p.peso_miligramas)||p.peso_miligramas<1||p.peso_miligramas>10000000||typeof p.tipo_peca!=='string'||!p.tipo_peca.trim()||p.tipo_peca.length>100||typeof p.descricao!=='string'||p.descricao.length>2000)) return res.sendStatus(400);
 // Client eligibility and store access policy must be verified before mounting this router.
 const {data,error}=await supabaseAdmin.rpc('criar_cotacao_cliente',{p_funcionario_id:actor.id,p_loja_id:scope.lojaId,p_cliente_id:clienteId,p_publicacao_id:publicacaoId,p_pecas:pecas.map(p=>({qualidade_id:p.qualidade_id,peso_miligramas:p.peso_miligramas,tipo_peca:p.tipo_peca,descricao:p.descricao}))});
 if(error) return failure(res,error);
 return res.status(201).json({success:true,id:data});
});
router.get('/quotes/:id',verifyAuth,async(req:AuthenticatedRequest,res:Response)=>{
 const actor=req.authenticatedUser;
 if(!actor?.ativo) return res.sendStatus(403);
 if(!uuid(req.params.id)) return res.sendStatus(400);
 const {data,error}=await supabaseAdmin.rpc('consultar_cotacao_cliente',{p_funcionario_id:actor.id,p_cotacao_id:req.params.id});
 if(error) return failure(res,error);
 return res.json({success:true,cotacao:data});
});
router.patch('/quotes/:id/state',verifyAuth,async(req:AuthenticatedRequest,res:Response)=>{
 const actor=req.authenticatedUser;
 if(!actor?.ativo) return res.sendStatus(403);
 if(!uuid(req.params.id)||!['apresentada','aceite','recusada','expirada'].includes(req.body?.estado)) return res.sendStatus(400);
 const {data,error}=await supabaseAdmin.rpc('alterar_estado_cotacao',{p_funcionario_id:actor.id,p_cotacao_id:req.params.id,p_estado:req.body.estado});
 if(error) return failure(res,error);
 return res.json({success:true,cotacao:data});
});
// Not mounted until migrations, client eligibility, signed evidence and integration tests are ready.
export default router;
