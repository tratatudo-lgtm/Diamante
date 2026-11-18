// PATH: src/components/finance/FinanceManagement.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useFinanceTransactions, useStores } from '../../hooks/useSupabaseData';
import {
  Wallet,
  Plus,
  Search,
  Building2,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Download,
  Filter,
  Check,
  X,
  Eye,
  ShieldCheck,
  Send,
  RefreshCw,
  Printer,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export type PaymentStatus = 'pago' | 'pendente' | 'rejeitado' | '';
export type PaymentMethod =
  | 'Transferência Imediata'
  | 'Transferência SEPA'
  | 'Numerário Balcão'
  | 'Cheque Bancário'
  | '';

export interface FinancialTransaction {
  id: string;
  referencia: string;
  lojaId: string;
  lojaNome: string;
  beneficiarioNome: string;
  beneficiarioNif: string;
  beneficiarioIban?: string;
  valor: number;
  estado: PaymentStatus;
  data: string;
  hora: string;
  metodo: PaymentMethod;
  contaOrigem: string;
  descricao: string;
  pesoOuroGramas?: number;
  tipoMetal?: string;
  operadorNome: string;
  comprovativoRef?: string;
}

interface FinanceManagementProps {
  onNavigate?: (path: string) => void;
}


type OperationalExpense = { id:string; loja_id:string; categoria:string; descricao:string; fornecedor?:string|null; valor:number; data_despesa:string; estado:'pendente'|'aprovada'|'rejeitada'|'paga'; motivo_rejeicao?:string|null };
const expenseCategories = [
  ['renda','Renda'],['pessoal','Pessoal'],['energia_agua','Energia e água'],['comunicacoes','Comunicações'],
  ['seguros','Seguros'],['manutencao','Manutenção'],['material','Material'],['marketing','Marketing'],
  ['servicos','Serviços'],['impostos_taxas','Impostos e taxas'],['transporte','Transporte'],['outros','Outros'],
] as const;
function OperationalExpensesPanel({ stores }: { stores: {id:string;nome:string}[] }) {
  const [rows,setRows]=useState<OperationalExpense[]>([]);
  const [summary,setSummary]=useState<{month:string;totals:{paid:number;pending:number;rejected:number};stores:{loja_id:string;paid:number;pending:number;rejected:number;byCategory:Record<string,number>}[]}|null>(null);
  const [selectedMonth,setSelectedMonth]=useState(new Date().toISOString().slice(0,7));
  const [closings,setClosings]=useState<any[]>([]);
  const [loadingRows,setLoadingRows]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({loja_id:'',categoria:'renda',descricao:'',fornecedor:'',valor:'',data_despesa:new Date().toISOString().slice(0,10)});
  const token=typeof window!=='undefined'?sessionStorage.getItem('diamante_jwt_token'):null;
  const request=async(path:string,init:RequestInit={})=>{
    if(!token)throw new Error('Sessão administrativa não encontrada.');
    const response=await fetch(path,{...init,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`,...(init.headers||{})},signal:AbortSignal.timeout(10000)});
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.success!==true)throw new Error(result?.message||'Não foi possível concluir a operação.');
    return result;
  };
  const load=async()=>{
    setLoadingRows(true);setError('');
    try{const [result,monthly]=await Promise.all([request('/api/admin/finance/expenses'),request('/api/admin/finance/expenses/summary?month='+encodeURIComponent(selectedMonth))]);setRows(Array.isArray(result.data)?result.data:[]);setSummary(monthly);}
    catch(e:any){setError(e?.message||'Falha ao carregar despesas.');}
    finally{setLoadingRows(false);}
  };
  useEffect(()=>{void load();},[]);
  useEffect(()=>{void request('/api/admin/finance/expenses/summary?month='+encodeURIComponent(selectedMonth)).then(setSummary).catch(e=>setError(e?.message||'Falha ao carregar resumo mensal.'));},[selectedMonth]);
  useEffect(()=>{void request('/api/admin/finance/closings?month='+encodeURIComponent(selectedMonth)).then(r=>setClosings(Array.isArray(r.data)?r.data:[])).catch(e=>setError(e?.message||'Falha ao carregar fechos.'));},[selectedMonth]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      await request('/api/admin/finance/expenses',{method:'POST',body:JSON.stringify({...form,valor:Number(form.valor)})});
      setForm(v=>({...v,descricao:'',fornecedor:'',valor:''}));await load();
    }catch(e:any){setError(e?.message||'Falha ao registar despesa.');}
    finally{setBusy(false);}
  };
  const changeStatus=async(id:string,estado:'aprovada'|'rejeitada'|'paga')=>{
    const motivo=estado==='rejeitada'?window.prompt('Indique o motivo da rejeição:')||'':'';
    if(estado==='rejeitada'&&motivo.trim().length<3)return;
    setBusy(true);setError('');
    try{await request(`/api/admin/finance/expenses/${encodeURIComponent(id)}/status`,{method:'PATCH',body:JSON.stringify({estado,motivo})});await load();}
    catch(e:any){setError(e?.message||'Falha ao actualizar despesa.');}
    finally{setBusy(false);}
  };
  const closeMonth=async(lojaId:string)=>{
    if(!window.confirm('Fechar definitivamente o mês '+selectedMonth+' para esta loja? As despesas deste período ficam bloqueadas.'))return;
    setBusy(true);setError('');
    try{await request('/api/admin/finance/closings',{method:'POST',body:JSON.stringify({loja_id:lojaId,month:selectedMonth})});const result=await request('/api/admin/finance/closings?month='+encodeURIComponent(selectedMonth));setClosings(result.data||[]);}
    catch(e:any){setError(e?.message||'Não foi possível fechar o mês.');}
    finally{setBusy(false);}
  };
  const reopenMonth=async(id:string)=>{
    const motivo=window.prompt('Motivo obrigatório para reabrir este mês:')||'';
    if(motivo.trim().length<5)return;
    setBusy(true);setError('');
    try{await request('/api/admin/finance/closings/'+encodeURIComponent(id)+'/reopen',{method:'POST',body:JSON.stringify({motivo})});const result=await request('/api/admin/finance/closings?month='+encodeURIComponent(selectedMonth));setClosings(result.data||[]);}
    catch(e:any){setError(e?.message||'Não foi possível reabrir o mês.');}
    finally{setBusy(false);}
  };
  const money=(n:number)=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(n)||0);
  const pending=rows.filter(r=>r.estado==='pendente').reduce((s,r)=>s+Number(r.valor),0);
  const paid=rows.filter(r=>r.estado==='paga').reduce((s,r)=>s+Number(r.valor),0);
  return <section aria-label="Despesas operacionais por loja" className="rounded-2xl border border-slate-800 bg-[#151b2b] p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Despesas Operacionais</h2><p className="text-xs text-slate-400">Registo, aprovação e liquidação de despesas por loja</p></div><button type="button" onClick={()=>void load()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Actualizar</button></div>
    {error&&<p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-xs text-slate-400">Por aprovar</p><p className="mt-1 text-xl font-bold text-amber-300">{money(pending)}</p></div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-xs text-slate-400">Despesas pagas</p><p className="mt-1 text-xl font-bold text-emerald-300">{money(paid)}</p></div>
    </div>
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl border border-slate-800 p-4">
      <label className="text-xs text-slate-400">Loja *<select required value={form.loja_id} onChange={e=>setForm(v=>({...v,loja_id:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] p-2.5 text-sm text-white"><option value="">Seleccionar loja</option>{stores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
      <label className="text-xs text-slate-400">Categoria *<select value={form.categoria} onChange={e=>setForm(v=>({...v,categoria:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] p-2.5 text-sm text-white">{expenseCategories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-xs text-slate-400">Valor (€) *<input required type="number" min="0.01" step="0.01" value={form.valor} onChange={e=>setForm(v=>({...v,valor:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] p-2.5 text-sm text-white"/></label>
      <label className="text-xs text-slate-400">Data da despesa *<input required type="date" value={form.data_despesa} onChange={e=>setForm(v=>({...v,data_despesa:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] p-2.5 text-sm text-white"/></label>
      <label className="text-xs text-slate-400">Fornecedor<input maxLength={180} value={form.fornecedor} onChange={e=>setForm(v=>({...v,fornecedor:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] p-2.5 text-sm text-white"/></label>
      <label className="text-xs text-slate-400">Descrição *<input required minLength={3} maxLength={1000} value={form.descricao} onChange={e=>setForm(v=>({...v,descricao:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] p-2.5 text-sm text-white"/></label>
      <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><button disabled={busy} className="rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{busy?'A guardar…':'Registar despesa'}</button></div>
    </form>
    {summary&&<div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Resumo mensal por loja</h3><input aria-label="Mês do resumo financeiro" type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-xs text-white"/></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="text-xs text-slate-400">Total liquidado</p><p className="mt-1 text-lg font-bold text-emerald-300">{money(summary.totals.paid)}</p></div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><p className="text-xs text-slate-400">Compromissos pendentes</p><p className="mt-1 text-lg font-bold text-amber-300">{money(summary.totals.pending)}</p></div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-3"><p className="text-xs text-slate-400">Despesas rejeitadas</p><p className="mt-1 text-lg font-bold text-slate-300">{money(summary.totals.rejected)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-[11px] uppercase text-slate-500"><tr><th className="p-3">Loja</th><th className="p-3">Liquidado</th><th className="p-3">Pendente</th><th className="p-3">Rejeitado</th></tr></thead><tbody className="divide-y divide-slate-800">{summary.stores.map(s=><tr key={s.loja_id}><td className="p-3 text-slate-300">{stores.find(x=>x.id===s.loja_id)?.nome||s.loja_id.slice(0,8)}</td><td className="p-3 font-semibold text-emerald-300">{money(s.paid)}</td><td className="p-3 text-amber-300">{money(s.pending)}</td><td className="p-3 text-slate-400">{money(s.rejected)}</td></tr>)}</tbody></table>{summary.stores.length===0&&<p className="p-4 text-center text-xs text-slate-500">Sem despesas neste mês.</p>}</div>
    </div>}
    <div className="space-y-3 rounded-xl border border-slate-800 p-4">
      <div><h3 className="text-sm font-semibold text-white">Fecho mensal por loja</h3><p className="text-xs text-slate-500">O fecho congela os valores do período e bloqueia alterações às despesas dessa loja.</p></div>
      <div className="space-y-2">{stores.map(store=>{const closing=closings.find(x=>x.loja_id===store.id);return <div key={store.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900/60 p-3"><div><p className="text-sm font-medium text-slate-200">{store.nome}</p><p className="text-xs text-slate-500">{closing?closing.estado==='fechado'?'Fechado em '+new Date(closing.fechado_em).toLocaleString('pt-PT'):'Reaberto':'Ainda sem fecho para '+selectedMonth}</p></div><div>{closing?.estado==='fechado'?<button type="button" disabled={busy} onClick={()=>void reopenMonth(closing.id)} className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-300 disabled:opacity-50">Reabrir com motivo</button>:<button type="button" disabled={busy} onClick={()=>void closeMonth(store.id)} className="rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Fechar mês</button>}</div></div>;})}</div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-[11px] uppercase text-slate-500"><tr><th className="p-3">Data / Loja</th><th className="p-3">Categoria / Descrição</th><th className="p-3">Valor</th><th className="p-3">Estado</th><th className="p-3">Acções</th></tr></thead><tbody className="divide-y divide-slate-800">{rows.map(row=><tr key={row.id}><td className="p-3 text-slate-300">{new Date(row.data_despesa+'T12:00:00').toLocaleDateString('pt-PT')}<span className="block text-xs text-slate-500">{stores.find(s=>s.id===row.loja_id)?.nome||'Loja'}</span></td><td className="p-3 text-slate-300">{expenseCategories.find(([v])=>v===row.categoria)?.[1]||row.categoria}<span className="block max-w-xs truncate text-xs text-slate-500">{row.descricao}{row.fornecedor?' · '+row.fornecedor:''}</span></td><td className="p-3 font-semibold text-white">{money(row.valor)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${row.estado==='paga'?'bg-emerald-500/10 text-emerald-300':row.estado==='rejeitada'?'bg-rose-500/10 text-rose-300':row.estado==='aprovada'?'bg-sky-500/10 text-sky-300':'bg-amber-500/10 text-amber-300'}`}>{row.estado}</span></td><td className="p-3"><div className="flex flex-wrap gap-1">{row.estado==='pendente'&&<><button disabled={busy} onClick={()=>void changeStatus(row.id,'aprovada')} className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">Aprovar</button><button disabled={busy} onClick={()=>void changeStatus(row.id,'rejeitada')} className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-300">Rejeitar</button></>}{row.estado==='aprovada'&&<button disabled={busy} onClick={()=>void changeStatus(row.id,'paga')} className="rounded bg-sky-500/10 px-2 py-1 text-xs text-sky-300">Marcar paga</button>}</div></td></tr>)}</tbody></table>{!loadingRows&&rows.length===0&&<p className="p-6 text-center text-sm text-slate-500">Ainda não existem despesas registadas.</p>}{loadingRows&&<p className="p-6 text-center text-sm text-slate-500">A carregar despesas…</p>}</div>
  </section>;
}

export const FinanceManagement: React.FC<FinanceManagementProps> = ({ onNavigate }) => {
  const {
    data: transactions,
    loading,
    error: dataError,
    confirmPayment,
    rejectPayment,
    createPayment,
  } = useFinanceTransactions();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: stores, error: storesError } = useStores();
  const storeOptions = stores.map((store) => ({ id: store.id, nome: store.nome }));

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PaymentStatus>('todos');
  const [storeFilter, setStoreFilter] = useState<string>('todas');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoje' | '7dias' | 'mes'>('todos');

  // Modais
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [paymentEvents, setPaymentEvents] = useState<Array<Record<string, any>>>([]);
  const [paymentEventsLoading, setPaymentEventsLoading] = useState(false);
  const [paymentEventsError, setPaymentEventsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!selectedTx?.id) {
      setPaymentEvents([]);
      setPaymentEventsError(null);
      return;
    }
    setPaymentEventsLoading(true);
    setPaymentEventsError(null);
    adminApiRequest(`/api/admin/finance/payments/${encodeURIComponent(selectedTx.id)}/events`)
      .then((result) => {
        if (active) setPaymentEvents(Array.isArray(result?.data) ? result.data : []);
      })
      .catch((error: any) => {
        if (active) setPaymentEventsError(error?.message || 'Não foi possível carregar o histórico.');
      })
      .finally(() => {
        if (active) setPaymentEventsLoading(false);
      });
    return () => { active = false; };
  }, [selectedTx?.id]);

  // Form State para Novo Pagamento
  const [newPayment, setNewPayment] = useState({
    lojaId: '',
    beneficiarioNome: '',
    beneficiarioNif: '',
    beneficiarioIban: '',
    valor: 0,
    metodo: 'Transferência Imediata' as PaymentMethod,
    contaOrigem: '',
    descricao: '',
    pesoOuroGramas: 0,
    tipoMetal: '',
    operadorNome: '',
  });

  // Saldo base da tesouraria

  // =========================================================
  // 1. ESTATÍSTICAS CALCULADAS EM TEMPO REAL
  // =========================================================
  const { totalPendenteValor, totalPendenteQtd, totalPagoHojeValor } = useMemo(() => {
    let pendenteVal = 0;
    let pendenteQtd = 0;
    let pagoHojeVal = 0;

    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString('pt-PT');

    transactions.forEach((tx) => {
      if (tx.estado === 'pendente') {
        pendenteVal += tx.valor;
        pendenteQtd += 1;
      }
      if (tx.estado === 'pago' && tx.data === dataHoje) {
        pagoHojeVal += tx.valor;
      }
    });

    return {
      totalPendenteValor: pendenteVal,
      totalPendenteQtd: pendenteQtd,
      totalPagoHojeValor: pagoHojeVal,
    };
  }, [transactions]);

  // Formatação de Valores Monetários em Euros
  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // =========================================================
  // 2. FILTRAGEM DE TRANSAÇÕES
  // =========================================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filtro por Estado
      if (statusFilter !== 'todos' && tx.estado !== statusFilter) {
        return false;
      }

      // Filtro por Loja
      if (storeFilter !== 'todas' && tx.lojaId !== storeFilter) {
        return false;
      }

      // Filtro por Data
      if (dateFilter === 'hoje' && tx.data !== new Date().toLocaleDateString('pt-PT')) {
        return false;
      }
      if (dateFilter === '7dias') {
        const [day, month, year] = tx.data.split('/').map(Number);
        const transactionDate = new Date(year, month - 1, day);
        const age = Date.now() - transactionDate.getTime();
        if (!day || !month || !year || age < 0 || age > 7 * 24 * 60 * 60 * 1000) return false;
      }

      // Pesquisa por Texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchRef = tx.referencia.toLowerCase().includes(q);
        const matchNome = tx.beneficiarioNome.toLowerCase().includes(q);
        const matchNif = tx.beneficiarioNif.includes(q);
        const matchIban = tx.beneficiarioIban?.toLowerCase().includes(q);
        const matchLoja = tx.lojaNome.toLowerCase().includes(q);
        const matchDesc = tx.descricao.toLowerCase().includes(q);

        if (!matchRef && !matchNome && !matchNif && !matchIban && !matchLoja && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, statusFilter, storeFilter, dateFilter, searchTerm]);

  // =========================================================
  // 3. AÇÕES RÁPIDAS (CONFIRMAR, REJEITAR, CRIAR)
  // =========================================================
  const handleConfirmPayment = async (txId: string) => {
    try {
      await confirmPayment(txId);
      if (selectedTx?.id === txId) setSelectedTx((prev) => prev ? { ...prev, estado: 'pago' } : null);
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao confirmar o pagamento.');
    }
  };

  const handleRejectPayment = async (txId: string) => {
    const motivo = window.prompt('Indique o motivo da rejeição (mínimo 5 caracteres):');
    if (motivo === null) return;
    if (motivo.trim().length < 5) {
      setActionError('O motivo da rejeição deve ter pelo menos 5 caracteres.');
      return;
    }
    try {
      await rejectPayment(txId, motivo.trim());
      if (selectedTx?.id === txId) setSelectedTx((prev) => prev ? { ...prev, estado: 'rejeitado' } : null);
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao rejeitar o pagamento.');
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.beneficiarioNome.trim() || !newPayment.valor) return;
    const storeObj = storeOptions.find((store) => store.id === newPayment.lojaId);
    if (!storeObj) {
      setActionError('Selecione uma loja existente antes de criar o pagamento.');
      return;
    }
    const refNum = Date.now();
    const referencia = `PAG-${refNum}`;
    const createdTx: FinancialTransaction = {
      id: '', referencia, lojaId: newPayment.lojaId, lojaNome: storeObj.nome,
      beneficiarioNome: newPayment.beneficiarioNome.trim(),
      beneficiarioNif: newPayment.beneficiarioNif.trim(),
      beneficiarioIban: newPayment.beneficiarioIban.trim().toUpperCase(),
      valor: Number(newPayment.valor), estado: 'pendente',
      data: new Date().toLocaleDateString('pt-PT'),
      hora: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      metodo: newPayment.metodo, contaOrigem: newPayment.contaOrigem,
      descricao: newPayment.descricao.trim(), pesoOuroGramas: Number(newPayment.pesoOuroGramas) || 0,
      tipoMetal: newPayment.tipoMetal, operadorNome: newPayment.operadorNome,
      comprovativoRef: '',
    };
    try {
      await createPayment(createdTx);
      setIsCreateModalOpen(false);
      setNewPayment({ lojaId: '', beneficiarioNome: '', beneficiarioNif: '', beneficiarioIban: '', valor: 0, metodo: 'Transferência Imediata', contaOrigem: '', descricao: '', pesoOuroGramas: 0, tipoMetal: '', operadorNome: '' });
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao criar o pagamento.');
    }
  };

  // Helper de Badge de Estado
  const renderStatusBadge = (estado: PaymentStatus) => {
    switch (estado) {
      case 'pago':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Liquidado / Pago
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Aguardar Validação
          </span>
        );
      case 'rejeitado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Rejeitado
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-400">Não definido</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {(dataError || storesError) && <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{dataError || storesError}</div>}
      {actionError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <div className="flex items-center justify-between gap-3">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="Fechar aviso">×</button>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* =========================================================
            1. HEADER
           ========================================================= */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                <Wallet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Financeiro & Tesouraria
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Gestão Central de Liquidações, Transferências Imediatas e Pagamentos a Clientes
                </p>
                {onNavigate && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onNavigate('/dashboard-admin')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] flex items-center gap-1 transition-colors cursor-pointer font-mono"
                    >
                      &larr; Sala de Guerra
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/stores')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Gestão de Lojas
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/employees')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Funcionários
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/clients')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Clientes & Fornecedores
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Pagamento</span>
          </button>
        </header>

        <OperationalExpensesPanel stores={storeOptions} />

        {/* =========================================================
            2. STATS CARDS FINANCEIROS (Topo)
           ========================================================= */}
        <section
          aria-label="Indicadores de Tesouraria"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Saldo Disponível */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Saldo Disponível em Conta
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                Não disponível
              </p>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sem contas bancárias configuradas
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Pagamentos Pendentes */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Pagamentos Pendentes
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                  {formatEUR(totalPendenteValor)}
                </p>
              </div>
              <p className="text-[11px] text-amber-400/90 font-mono">
                {totalPendenteQtd} pedidos a aguardar liquidação
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Total Pago Hoje */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Pago Hoje
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {formatEUR(totalPagoHojeValor)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Liquidações diretas aos balcões
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS RÁPIDOS
           ========================================================= */}
        <section
          aria-label="Filtros e Pesquisa Financeira"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
        >
          {/* Linha 1: Pesquisa + Filtro de Balcão */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por referência, cliente, NIF, IBAN ou balcão..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown de Filtro por Loja */}
            <div className="w-full md:w-72 shrink-0">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
              >
                <option value="todas">Todas as Lojas ({storeOptions.length})</option>
                {storeOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Filtros Pill por Estado e Data */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {/* Estado Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Estado:
              </span>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'todos'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({transactions.length})
              </button>
              <button
                onClick={() => setStatusFilter('pendente')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'pendente'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-amber-400 border border-slate-800'
                }`}
              >
                Pendentes ({totalPendenteQtd})
              </button>
              <button
                onClick={() => setStatusFilter('pago')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'pago'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                Pagos ({transactions.filter((t) => t.estado === 'pago').length})
              </button>
              <button
                onClick={() => setStatusFilter('rejeitado')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'rejeitado'
                    ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                Rejeitados ({transactions.filter((t) => t.estado === 'rejeitado').length})
              </button>
            </div>

            {/* Período Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Período:
              </span>
              {(['todos', 'hoje', '7dias', 'mes'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setDateFilter(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize ${
                    dateFilter === p
                      ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                      : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {p === '7dias' ? 'Últimos 7 dias' : p === 'mes' ? 'Este Mês' : p}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            4. LISTA / TABELA RESPONSIVA DE TRANSAÇÕES FINANCEIRAS
           ========================================================= */}
        <section aria-label="Histórico de Pagamentos">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Wallet className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">Nenhum pagamento encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem transações financeiras correspondentes aos filtros selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('todos');
                  setStoreFilter('todas');
                  setDateFilter('todos');
                }}
                className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW: Tabela Elegante (Visível em md+) */}
              <div className="hidden md:block rounded-2xl bg-[#151b2b] border border-slate-800/90 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b0f19] text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Ref. / Transação</th>
                        <th className="py-3.5 px-4">Balcão Origem</th>
                        <th className="py-3.5 px-4">Beneficiário (Cliente)</th>
                        <th className="py-3.5 px-4">Método</th>
                        <th className="py-3.5 px-4">Data / Hora</th>
                        <th className="py-3.5 px-4">Valor Liquidado</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Referência */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-[#D4AF37] group-hover:underline">
                              {tx.referencia}
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                              {tx.tipoMetal || 'Ouro Geral'}
                            </p>
                          </td>

                          {/* Balcão */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 max-w-[180px] truncate" title={tx.lojaNome}>
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-white font-medium">
                                {tx.lojaNome.replace("Diamante D'ouro - ", '')}
                              </span>
                            </div>
                          </td>

                          {/* Beneficiário */}
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-white truncate max-w-[170px]">
                              {tx.beneficiarioNome}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              NIF: {tx.beneficiarioNif}
                            </p>
                          </td>

                          {/* Método */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {tx.metodo}
                          </td>

                          {/* Data / Hora */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            <span>{tx.data}</span>
                            <span className="text-slate-400 ml-1.5">{tx.hora}</span>
                          </td>

                          {/* Valor */}
                          <td className="py-3.5 px-4 font-mono text-sm font-bold text-white">
                            {formatEUR(tx.valor)}
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(tx.estado)}
                          </td>

                          {/* Ações Rápidas */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {tx.estado === 'pendente' && (
                                <>
                                  <button
                                    onClick={() => handleConfirmPayment(tx.id)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                                    title="Confirmar Liquidação Imediata"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectPayment(tx.id)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                    title="Rejeitar Pagamento"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedTx(tx)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] transition-colors cursor-pointer"
                                title="Ver Detalhes e Comprovativo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE VIEW: Cards Verticais Elegantes (Visível em <md) */}
              <div className="md:hidden space-y-3">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-bold text-[#D4AF37]">
                          {tx.referencia}
                        </span>
                        <h2 className="font-bold text-sm text-white truncate">
                          {tx.beneficiarioNome}
                        </h2>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-base text-white">
                          {formatEUR(tx.valor)}
                        </p>
                      </div>
                    </div>

                    {/* Informações da Transação */}
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balcão:</span>
                        <span className="text-white font-medium truncate max-w-[200px]">
                          {tx.lojaNome.replace("Diamante D'ouro - ", '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Método:</span>
                        <span className="font-mono text-slate-200">{tx.metodo}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Data / Hora:</span>
                        <span className="font-mono text-slate-300">
                          {tx.data} às {tx.hora}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Estado:</span>
                        {renderStatusBadge(tx.estado)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE DETALHES DO PAGAMENTO & COMPROVATIVO
           ========================================================= */}
        {selectedTx && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedTx(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                      {selectedTx.referencia}
                    </span>
                    {renderStatusBadge(selectedTx.estado)}
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1.5">
                    {formatEUR(selectedTx.valor)}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    {selectedTx.metodo} &bull; {selectedTx.data} às {selectedTx.hora}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações Completas */}
              <div className="p-6 space-y-4 text-xs text-slate-300">
                {/* Beneficiário e Dados Bancários */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dados do Beneficiário & Destino</span>
                  </h4>
                  <div className="space-y-1">
                    <p>
                      <span className="text-slate-400">Nome:</span>{' '}
                      <strong className="text-white">{selectedTx.beneficiarioNome}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">NIF Cliente:</span>{' '}
                      <span className="font-mono text-white">{selectedTx.beneficiarioNif}</span>
                    </p>
                    {selectedTx.beneficiarioIban && (
                      <p>
                        <span className="text-slate-400">IBAN Destino:</span>{' '}
                        <span className="font-mono text-white select-all">
                          {selectedTx.beneficiarioIban}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Dados da Compra de Ouro */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                    <span>Origem & Descrição da Transação</span>
                  </h4>
                  <div className="space-y-1">
                    <p>
                      <span className="text-slate-400">Balcão Emissor:</span>{' '}
                      <strong className="text-white">{selectedTx.lojaNome}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Conta de Saída:</span>{' '}
                      <span className="text-slate-200">{selectedTx.contaOrigem}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Operador Responsável:</span>{' '}
                      <span className="text-white">{selectedTx.operadorNome}</span>
                    </p>
                    <p className="pt-1 text-slate-300 italic border-t border-slate-800/80">
                      "{selectedTx.descricao}"
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0b0f19] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white">Histórico de auditoria</h4>
                    <span className="text-[10px] text-slate-500">Registos imutáveis</span>
                  </div>
                  {paymentEventsLoading ? (
                    <p className="text-xs text-slate-400">A carregar histórico…</p>
                  ) : paymentEventsError ? (
                    <p className="text-xs text-rose-300">{paymentEventsError}</p>
                  ) : paymentEvents.length === 0 ? (
                    <p className="text-xs text-slate-400">Sem eventos de auditoria disponíveis.</p>
                  ) : (
                    <ol className="space-y-2">
                      {paymentEvents.map((event) => (
                        <li key={event.id} className="border-l-2 border-amber-500/40 pl-3">
                          <p className="text-xs font-semibold text-slate-200">
                            {event.acao === 'legacy_import' ? 'Registo histórico importado' :
                             event.acao === 'marcado_pago' ? 'Marcado como pago' :
                             event.acao === 'rejeitado' ? 'Pagamento rejeitado' : 'Pagamento registado'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {event.created_at ? new Date(event.created_at).toLocaleString('pt-PT') : 'Data não disponível'}
                            {event.actor_id ? ` · Administrador: ${event.actor_id}` : ' · Responsável não registado'}
                          </p>
                          {event.motivo && <p className="text-[10px] text-slate-400 mt-1">{event.motivo}</p>}
                          {event.snapshot?.legacy_import === true && (
                            <p className="text-[10px] text-amber-300 mt-1">Estado existente na migração; não representa a data comprovada da transição original.</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Referência documental fornecida no registo; não comprova liquidação bancária. */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <div>
                      <p className="text-[11px] font-semibold text-white">
                        Referência documental (não verificada)
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        Ref: {selectedTx.comprovativoRef || 'Sem referência documental'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Visualizar registo</span>
                  </button>
                </div>
              </div>

              {/* Ações do Rodapé */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                {selectedTx.estado === 'pendente' ? (
                  <>
                    <button
                      onClick={() => handleRejectPayment(selectedTx.id)}
                      className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Rejeitar Pagamento
                    </button>

                    <button
                      onClick={() => handleConfirmPayment(selectedTx.id)}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-[#D4AF37]/25 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Marcar como pago (confirmação manual)</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsReceiptModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-[#D4AF37]" />
                      <span>Imprimir registo interno</span>
                    </button>

                    <button
                      onClick={() => setSelectedTx(null)}
                      className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL DO REGISTO INTERNO DE PAGAMENTO (não é comprovativo bancário)
           ========================================================= */}
        {isReceiptModalOpen && selectedTx && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsReceiptModalOpen(false)}
          >
            <div
              className="bg-white text-slate-950 rounded-2xl max-w-md w-full p-6 shadow-2xl relative font-sans space-y-4 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-base tracking-wider uppercase">
                    Diamante D'ouro
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Dados fiscais e de Contrastaria não configurados.
                  </p>
                </div>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center py-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Registo Interno de Pagamento
                </span>
                <p className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatEUR(selectedTx.valor)}
                </p>
                <p className={`text-xs font-bold uppercase mt-1 ${selectedTx.estado === 'pago' ? 'text-amber-700' : selectedTx.estado === 'rejeitado' ? 'text-rose-700' : 'text-slate-600'}`}>
                  {selectedTx.estado === 'pago'
                    ? 'Marcado como pago no sistema — sem confirmação bancária integrada'
                    : selectedTx.estado === 'rejeitado'
                      ? 'Pagamento rejeitado'
                      : 'Pagamento pendente'}
                </p>
              </div>

              <div className="text-xs space-y-2 border-y py-3 border-dashed">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ref. Operação:</span>
                  <span className="font-mono font-bold">{selectedTx.referencia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data e Hora:</span>
                  <span className="font-mono">
                    {selectedTx.data} às {selectedTx.hora}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Beneficiário:</span>
                  <span className="font-bold">{selectedTx.beneficiarioNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIF Beneficiário:</span>
                  <span className="font-mono">{selectedTx.beneficiarioNif}</span>
                </div>
                {selectedTx.beneficiarioIban && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">IBAN Destino:</span>
                    <span className="font-mono text-[10px]">{selectedTx.beneficiarioIban}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Balcão de Origem:</span>
                  <span className="font-medium">{selectedTx.lojaNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Referência indicada:</span>
                  <span className="font-mono text-[10px]">
                    {selectedTx.comprovativoRef || 'Não fornecido'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center leading-relaxed">
                Este documento é apenas um registo interno dos dados introduzidos no sistema.
                Não constitui comprovativo bancário, confirmação SEPA ou prova de liquidação.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 font-semibold text-xs"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            7. MODAL: NOVO PAGAMENTO (Formulário)
           ========================================================= */}
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#D4AF37]" />
                  <span>Registar Nova Ordem de Pagamento</span>
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePayment} className="p-6 space-y-4 text-xs">
                {/* Balcão */}
                <div>
                  <label className="block text-slate-400 mb-1">Balcão de Origem da Compra *</label>
                  <select
                    value={newPayment.lojaId}
                    onChange={(e) => setNewPayment({ ...newPayment, lojaId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                  >
                    {storeOptions.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Nome do Beneficiário */}
                  <div>
                    <label className="block text-slate-400 mb-1">Nome do Cliente / Beneficiário *</label>
                    <input
                      type="text"
                      required
                      value={newPayment.beneficiarioNome}
                      onChange={(e) =>
                        setNewPayment({ ...newPayment, beneficiarioNome: e.target.value })
                      }
                      placeholder="Ex: Maria Santos"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 mb-1">NIF do Cliente *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={newPayment.beneficiarioNif}
                      onChange={(e) =>
                        setNewPayment({ ...newPayment, beneficiarioNif: e.target.value })
                      }
                      placeholder="213456789"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* IBAN */}
                <div>
                  <label className="block text-slate-400 mb-1">IBAN de Destino (SEPA) *</label>
                  <input
                    type="text"
                    required
                    value={newPayment.beneficiarioIban}
                    onChange={(e) =>
                      setNewPayment({ ...newPayment, beneficiarioIban: e.target.value })
                    }
                    placeholder="IBAN do beneficiário"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono uppercase focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Valor (€) */}
                  <div>
                    <label className="block text-slate-400 mb-1">Valor a Liquidar (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newPayment.valor}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          valor: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Método */}
                  <div>
                    <label className="block text-slate-400 mb-1">Método de Liquidação</label>
                    <select
                      value={newPayment.metodo}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          metodo: e.target.value as PaymentMethod,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="Transferência Imediata">Transferência Imediata</option>
                      <option value="Transferência SEPA">Transferência SEPA</option>
                      <option value="Numerário Balcão">Numerário Balcão</option>
                      <option value="Cheque Bancário">Cheque Bancário</option>
                    </select>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-slate-400 mb-1">Descrição / Lote de Ouro</label>
                  <input
                    type="text"
                    value={newPayment.descricao}
                    onChange={(e) => setNewPayment({ ...newPayment, descricao: e.target.value })}
                    placeholder="Ex: Compra de Ouro 19.2k (34.5g)"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    Submeter Pagamento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceManagement;
