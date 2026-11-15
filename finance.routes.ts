import { Router, Request, Response } from 'express';
import { supabaseAdmin } from './auth.service';
import { verifyAdmin } from './middleware/verifyAdmin';

const router = Router();
router.use(verifyAdmin);

const PAYMENT_METHODS = new Set([
  'Transferência Imediata',
  'Transferência SEPA',
  'Numerário Balcão',
  'Cheque Bancário',
]);

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

router.get('/payments', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('transacoes_financeiras')
      .select('*, lojas(nome)')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      console.error('[FINANCE] Falha ao listar pagamentos.');
      return res.status(503).json({ success: false, message: 'Não foi possível carregar os pagamentos.' });
    }
    return res.json({ success: true, data: data || [] });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao carregar pagamentos.' });
  }
});

router.post('/payments', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const referencia = text(body.referencia, 80);
    const lojaId = text(body.loja_id, 64);
    const beneficiarioNome = text(body.beneficiario_nome, 160);
    const valor = Number(body.valor);
    const metodo = text(body.metodo, 64);

    if (!referencia || !lojaId || !beneficiarioNome || !Number.isFinite(valor) || valor <= 0 || valor > 999999999999.99 || Math.round(valor * 100) !== valor * 100 || !PAYMENT_METHODS.has(metodo)) {
      return res.status(400).json({ success: false, message: 'Dados do pagamento inválidos.' });
    }

    const { data: store, error: storeError } = await supabaseAdmin
      .from('lojas').select('id, nome, ativo').eq('id', lojaId).maybeSingle();
    if (storeError) {
      console.error('[FINANCE] Falha ao validar loja do pagamento.');
      return res.status(503).json({ success: false, message: 'Não foi possível validar a loja.' });
    }
    if (!store || store.ativo !== true) return res.status(400).json({ success: false, message: 'A loja selecionada não existe ou está inativa.' });

    const { data, error } = await supabaseAdmin
      .from('transacoes_financeiras')
      .insert({
        referencia,
        loja_id: store.id,
        loja_nome: store.nome,
        beneficiario_nome: beneficiarioNome,
        beneficiario_nif: text(body.beneficiario_nif, 32),
        beneficiario_iban: text(body.beneficiario_iban, 64) || null,
        valor,
        estado: 'pendente',
        metodo,
        conta_origem: text(body.conta_origem, 160) || null,
        descricao: text(body.descricao, 1000) || null,
        peso_ouro_gramas: Number.isFinite(Number(body.peso_ouro_gramas)) && Number(body.peso_ouro_gramas) >= 0 ? Number(body.peso_ouro_gramas) : null,
        tipo_metal: text(body.tipo_metal, 64) || null,
        operador_nome: text(body.operador_nome, 160) || null,
        data: text(body.data, 32) || null,
        hora: text(body.hora, 16) || null,
        comprovativo_ref: text(body.comprovativo_ref, 500) || null,
      })
      .select('*, lojas(nome)')
      .single();

    if (error || !data) {
      console.error('[FINANCE] Falha ao criar pagamento.');
      return res.status(503).json({ success: false, message: 'Não foi possível criar o pagamento.' });
    }
    return res.status(201).json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao criar pagamento.' });
  }
});

router.patch('/payments/:id/status', async (req: Request, res: Response) => {
  try {
    const id = text(req.params.id, 64);
    const estado = text(req.body?.estado, 16);
    if (!id || !['pago', 'rejeitado'].includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado de pagamento inválido.' });
    }

    const { data, error } = await supabaseAdmin
      .from('transacoes_financeiras')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('estado', 'pendente')
      .select('id, estado')
      .maybeSingle();

    if (error) {
      console.error('[FINANCE] Falha ao atualizar estado do pagamento.');
      return res.status(503).json({ success: false, message: 'Não foi possível actualizar o pagamento.' });
    }
    if (!data) return res.status(409).json({ success: false, message: 'Pagamento não encontrado ou já processado.' });
    return res.json({ success: true, payment: data });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao actualizar pagamento.' });
  }
});


const EXPENSE_CATEGORIES = new Set(['renda','pessoal','energia_agua','comunicacoes','seguros','manutencao','material','marketing','servicos','impostos_taxas','transporte','outros']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const storeId = text(req.query.loja_id, 64);
    if (storeId && !UUID_RE.test(storeId)) return res.status(400).json({ success:false, message:'Identificador de loja inválido.' });
    const pageSize = 500;
    const allExpenses: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += pageSize) {
      let query = supabaseAdmin.from('despesas_operacionais').select('id,loja_id,categoria,descricao,fornecedor,referencia_documento,valor,data_despesa,estado,comprovativo_ref,criado_por,aprovado_por,pago_por,motivo_rejeicao,created_at,approved_at,paid_at,lojas(nome)').order('data_despesa',{ascending:false}).range(offset, offset + pageSize - 1);
      if (storeId) query = query.eq('loja_id',storeId);
      const {data,error}=await query;
      if(error){console.error('[FINANCE] Falha ao consultar despesas.');return res.status(503).json({success:false,message:'Não foi possível carregar as despesas.'});}
      allExpenses.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return res.json({success:true,data:allExpenses});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao carregar despesas.'}); }
});

router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const b=req.body||{}, lojaId=text(b.loja_id,64), categoria=text(b.categoria,40), descricao=text(b.descricao,1000), valor=Number(b.valor), dataDespesa=text(b.data_despesa,10);
    if(!UUID_RE.test(lojaId)||!EXPENSE_CATEGORIES.has(categoria)||descricao.length<3||!Number.isFinite(valor)||valor<=0||valor>999999999999.99||Math.round(valor*100)!==valor*100||!/^\d{4}-\d{2}-\d{2}$/.test(dataDespesa)||Number.isNaN(Date.parse(dataDespesa+'T00:00:00Z'))) return res.status(400).json({success:false,message:'Dados da despesa inválidos.'});
    const {data:store,error:storeError}=await supabaseAdmin.from('lojas').select('id').eq('id',lojaId).eq('ativo',true).maybeSingle();
    if(storeError)return res.status(503).json({success:false,message:'Não foi possível validar a loja.'});
    if(!store)return res.status(400).json({success:false,message:'A loja não existe ou está inactiva.'});
    const {data,error}=await supabaseAdmin.from('despesas_operacionais').insert({loja_id:lojaId,categoria,descricao,valor,data_despesa:dataDespesa,fornecedor:text(b.fornecedor,180)||null,referencia_documento:text(b.referencia_documento,120)||null,comprovativo_ref:text(b.comprovativo_ref,500)||null,criado_por:(req as any).adminUser?.id||null,estado:'pendente'}).select('id,loja_id,categoria,descricao,fornecedor,referencia_documento,valor,data_despesa,estado,created_at').single();
    if(error||!data){console.error('[FINANCE] Falha ao registar despesa.');return res.status(503).json({success:false,message:'Não foi possível registar a despesa.'});}
    return res.status(201).json({success:true,data});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao registar despesa.'}); }
});

router.patch('/expenses/:id/status', async (req: Request, res: Response) => {
  try {
    const id=text(req.params.id,64), nextStatus=text(req.body?.estado,16), reason=text(req.body?.motivo,500);
    if(!UUID_RE.test(id)||!['aprovada','rejeitada','paga'].includes(nextStatus))return res.status(400).json({success:false,message:'Transição de despesa inválida.'});
    const {data:current,error:readError}=await supabaseAdmin.from('despesas_operacionais').select('id,estado').eq('id',id).maybeSingle();
    if(readError)return res.status(503).json({success:false,message:'Não foi possível consultar a despesa.'});
    if(!current)return res.status(404).json({success:false,message:'Despesa não encontrada.'});
    const allowed=(current.estado==='pendente'&&['aprovada','rejeitada'].includes(nextStatus))||(current.estado==='aprovada'&&nextStatus==='paga');
    if(!allowed)return res.status(409).json({success:false,message:'A despesa já foi processada ou a transição não é permitida.'});
    if(nextStatus==='rejeitada'&&reason.length<3)return res.status(400).json({success:false,message:'Indique o motivo da rejeição.'});
    const actor=(req as any).adminUser?.id||null, now=new Date().toISOString(), update:Record<string,unknown>={estado:nextStatus,updated_at:now};
    if(nextStatus==='aprovada'){update.aprovado_por=actor;update.approved_at=now;}
    if(nextStatus==='rejeitada')update.motivo_rejeicao=reason;
    if(nextStatus==='paga'){update.pago_por=actor;update.paid_at=now;}
    const {data,error}=await supabaseAdmin.from('despesas_operacionais').update(update).eq('id',id).eq('estado',current.estado).select('id,estado,approved_at,paid_at').maybeSingle();
    if(error)return res.status(503).json({success:false,message:'Não foi possível actualizar a despesa.'});
    if(!data)return res.status(409).json({success:false,message:'A despesa foi alterada por outro administrador. Actualize a lista.'});
    return res.json({success:true,data});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao actualizar despesa.'}); }
});


router.get('/expenses/summary', async (req: Request, res: Response) => {
  try {
    const month = text(req.query.month, 7) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Mês inválido. Use AAAA-MM.' });
    }
    const start = `${month}-01`;
    const [year, monthNumber] = month.split('-').map(Number);
    const endDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    const allRows: Array<{ loja_id: string; categoria: string; valor: number | string; estado: string; data_despesa: string }> = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error } = await supabaseAdmin.from('despesas_operacionais')
        .select('loja_id,categoria,valor,estado,data_despesa')
        .gte('data_despesa', start).lt('data_despesa', endDate)
        .order('data_despesa', { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) {
        console.error('[FINANCE] Falha ao calcular resumo de despesas.');
        return res.status(503).json({ success: false, message: 'Não foi possível calcular o resumo financeiro.' });
      }
      allRows.push(...(page || []));
      if (!page || page.length < pageSize) break;
    }
    const stores = new Map<string, { loja_id: string; paid: number; pending: number; rejected: number; byCategory: Record<string, number> }>();
    let paid = 0, pending = 0, rejected = 0;
    for (const row of allRows) {
      const value = Number(row.valor) || 0;
      if (!stores.has(row.loja_id)) stores.set(row.loja_id, { loja_id: row.loja_id, paid: 0, pending: 0, rejected: 0, byCategory: {} });
      const store = stores.get(row.loja_id)!;
      if (row.estado === 'paga') { paid += value; store.paid += value; store.byCategory[row.categoria] = (store.byCategory[row.categoria] || 0) + value; }
      else if (row.estado === 'pendente' || row.estado === 'aprovada') { pending += value; store.pending += value; }
      else if (row.estado === 'rejeitada') { rejected += value; store.rejected += value; }
    }
    return res.json({ success: true, month, totals: { paid, pending, rejected }, stores: Array.from(stores.values()).sort((a,b) => b.paid - a.paid) });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao calcular resumo financeiro.' });
  }
});


router.get('/closings', async (req: Request, res: Response) => {
  try {
    const month=text(req.query.month,7);
    if(month&&!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month))return res.status(400).json({success:false,message:'Mês inválido. Use AAAA-MM.'});
    let query=supabaseAdmin.from('fechos_financeiros_loja')
      .select('id,loja_id,periodo,estado,total_pago,total_pendente,total_rejeitado,quantidade_despesas,snapshot_categorias,fechado_por,fechado_em,reaberto_por,reaberto_em,motivo_reabertura,lojas(nome)')
      .order('periodo',{ascending:false}).limit(500);
    if(month)query=query.eq('periodo',month+'-01');
    const {data,error}=await query;
    if(error)return res.status(503).json({success:false,message:'Não foi possível consultar os fechos.'});
    return res.json({success:true,data:data||[]});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao consultar fechos.'}); }
});

router.get('/closings/:id/events', async (req: Request, res: Response) => {
  try {
    const id=text(req.params.id,64);
    if(!UUID_RE.test(id))return res.status(400).json({success:false,message:'Identificador de fecho inválido.'});
    const {data,error}=await supabaseAdmin.from('fechos_financeiros_eventos')
      .select('id,fecho_id,loja_id,periodo,acao,actor_id,motivo,snapshot,created_at')
      .eq('fecho_id',id).order('created_at',{ascending:true}).limit(200);
    if(error)return res.status(503).json({success:false,message:'Não foi possível consultar o histórico.'});
    return res.json({success:true,data:data||[]});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao consultar histórico.'}); }
});

router.post('/closings', async (req: Request, res: Response) => {
  try {
    const lojaId=text(req.body?.loja_id,64), month=text(req.body?.month,7);
    if(!UUID_RE.test(lojaId)||!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return res.status(400).json({success:false,message:'Loja ou mês inválido.'});
    const actor=(req as any).adminUser?.id;
    if(!actor||!UUID_RE.test(actor))return res.status(401).json({success:false,message:'Sessão administrativa inválida.'});
    const {data,error}=await supabaseAdmin.rpc('fn_fechar_mes_financeiro',{p_loja_id:lojaId,p_periodo:month+'-01',p_actor_id:actor});
    if(error){
      const msg=error.code==='23505'?'Este mês já está fechado.':error.code==='42501'?'Apenas administradores activos podem fechar o mês.':'Não foi possível fechar o mês. Verifique os dados e tente novamente.';
      const status=error.code==='23505'?409:error.code==='42501'?403:400;
      return res.status(status).json({success:false,message:msg});
    }
    return res.status(201).json({success:true,data});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao fechar mês.'}); }
});

router.post('/closings/:id/reopen', async (req: Request, res: Response) => {
  try {
    const id=text(req.params.id,64), motivo=text(req.body?.motivo,1000), actor=(req as any).adminUser?.id;
    if(!UUID_RE.test(id)||motivo.length<5)return res.status(400).json({success:false,message:'Fecho inválido ou motivo de reabertura insuficiente.'});
    if(!actor||!UUID_RE.test(actor))return res.status(401).json({success:false,message:'Sessão administrativa inválida.'});
    const {data,error}=await supabaseAdmin.rpc('fn_reabrir_mes_financeiro',{p_fecho_id:id,p_actor_id:actor,p_motivo:motivo});
    if(error){
      const status=error.code==='42501'?403:error.code==='55000'?409:400;
      return res.status(status).json({success:false,message:error.code==='42501'?'Apenas administradores activos podem reabrir.':error.code==='55000'?'O fecho não existe ou já foi reaberto.':'Não foi possível reabrir o mês.'});
    }
    return res.json({success:true,data});
  } catch { return res.status(500).json({success:false,message:'Erro interno ao reabrir mês.'}); }
});

export default router;
