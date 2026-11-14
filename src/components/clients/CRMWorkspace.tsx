import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users, Building2, ArrowLeft, RefreshCw, FileText, Image as ImageIcon, Clock3, Coins, Scale, ShieldCheck, AlertCircle, UserRound, Paperclip } from 'lucide-react';

type Client = {
  id: string; nome: string; bi_cc?: string | null; telemovel?: string | null; email?: string | null;
  morada?: string | null; contacto?: string | null; total_transacoes?: number; total_volume?: number;
  ultima_transacao?: string | null; loja_nome?: string | null; created_at?: string | null;
};
type Transaction = {
  id: string; created_at: string; estado: string; valor_final: number | null; peso_gramas: number | null;
  tipo_peca?: string | null; metal?: string | null; loja_nome?: string | null;
  origem_ligacao: 'confirmada' | 'nome_nao_confirmado';
};
type Article = { id: string; transacao_id: string; tipo?: string; descricao?: string; peso_gramas?: number; quilates?: number; foto_url?: string | null; foto_signed_url?: string | null; estado?: string };
type Attachment = { id: string; nome_ficheiro: string; mime_type: string; tamanho_bytes: number; categoria: string; signed_url?: string | null; created_at: string };
type IdentityDocument = { id: string; tipo_documento: string; numero_documento: string; data_emissao?: string | null; data_validade: string; mime_type: string; tamanho_bytes: number; uploaded_at: string; substituido_em?: string | null; signed_url?: string | null };
type DocumentAlert = { cliente_id: string; nome: string; nif?: string | null; telemovel?: string | null; data_validade_documento: string; dias_ate_validade: number; estado_documento: 'expirado' | 'a_expirar' };
type Supplier = { id: string; nome: string; nif?: string; contacto?: string; email?: string; morada?: string; observacoes?: string; ativo: boolean };

const token = () => sessionStorage.getItem('diamante_jwt_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });
const eur = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
const date = (v?: string | null) => v ? new Date(v).toLocaleString('pt-PT') : '—';
const bytes = (v: number) => v < 1024 * 1024 ? `${(v / 1024).toFixed(0)} KB` : `${(v / 1024 / 1024).toFixed(1)} MB`;

export const CRMWorkspace: React.FC = () => {
  const [tab, setTab] = useState<'clients' | 'suppliers'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{client: Client; transactions: Transaction[]; articles: Article[]; attachments: Attachment[]; documents: IdentityDocument[]} | null>(null);
  const [documentAlerts, setDocumentAlerts] = useState<DocumentAlert[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('cc');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentIssueDate, setDocumentIssueDate] = useState('');
  const [documentExpiryDate, setDocumentExpiryDate] = useState('');
  const [documentSaving, setDocumentSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [c, s] = await Promise.all([
        fetch('/api/admin/crm/clients', { headers: headers() }),
        fetch('/api/admin/crm/suppliers', { headers: headers() })
      ]);
      if (!c.ok || !s.ok) throw new Error('Não foi possível carregar o CRM. Confirme a sessão administrativa.');
      const cj = await c.json(); const sj = await s.json();
      setClients(cj.data || []); setSuppliers(sj.data || []);
      const alertsResponse = await fetch('/api/clients/document-alerts', { headers: headers() });
      if (alertsResponse.ok) { const alertsJson = await alertsResponse.json(); setDocumentAlerts(alertsJson.alertas || []); }
    } catch (e: any) { setError(e?.message || 'Falha ao carregar o CRM.'); }
    finally { setLoading(false); }
  }, []);

  const openClient = useCallback(async (id: string) => {
    setSelected(id); setDetail(null); setDetailLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/crm/clients/${encodeURIComponent(id)}`, { headers: headers() });
      if (!r.ok) throw new Error('Não foi possível abrir a ficha do cliente.');
      const j = await r.json();
      setDetail({ client: j.client, transactions: j.transactions || [], articles: j.articles || [], attachments: j.attachments || [] });
    } catch (e: any) { setError(e?.message || 'Falha ao abrir a ficha.'); }
    finally { setDetailLoading(false); }
  }, []);

  const uploadIdentityDocument = useCallback(async () => {
    if (!detail || !documentFile || !documentNumber.trim() || !documentExpiryDate) {
      setError('Seleccione o ficheiro e preencha o número e a validade do documento.');
      return;
    }
    if (documentFile.size > 6 * 1024 * 1024) {
      setError('O ficheiro não pode exceder 6 MB.');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(documentFile.type)) {
      setError('Formato não permitido. Utilize PDF, JPEG, PNG ou WebP.');
      return;
    }
    setDocumentSaving(true); setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'));
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.readAsDataURL(documentFile);
      });
      const response = await fetch(`/api/clients/${encodeURIComponent(detail.client.id)}/documents`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoDocumento: documentType, numeroDocumento: documentNumber, dataEmissao: documentIssueDate || null, dataValidade: documentExpiryDate, mimeType: documentFile.type, fileName: documentFile.name, fileBase64: base64 }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) throw new Error(result?.message || 'Não foi possível actualizar o documento.');
      setDocumentFile(null);
      await openClient(detail.client.id);
      await load();
    } catch (e: any) { setError(e?.message || 'Falha ao digitalizar documento.'); }
    finally { setDocumentSaving(false); }
  }, [detail, documentFile, documentType, documentNumber, documentIssueDate, documentExpiryDate, openClient, load]);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => clients.filter(c => [c.nome,c.nif,c.bi_cc,c.telemovel,c.email,c.contacto].some(v => String(v || '').toLowerCase().includes(query.toLowerCase().trim()))), [clients, query]);
  const articlesByTx = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of detail?.articles || []) map.set(a.transacao_id, [...(map.get(a.transacao_id) || []), a]);
    return map;
  }, [detail]);

  return <div className="min-h-screen bg-[#080d17] text-slate-100">
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-amber-500/[0.07] blur-[110px]"/><div className="absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-cyan-500/[0.05] blur-[110px]"/></div>
    <div className="relative mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-amber-300"><ShieldCheck size={14}/> Diamante Intelligence / CRM</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Clientes & Fornecedores</h1>
          <p className="mt-2 text-sm text-slate-400">Relações, histórico comercial e documentação num só espaço.</p></div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-amber-300/30 hover:bg-white/[.07]"><RefreshCw size={15}/> Atualizar</button>
      </div>
      <div className="mb-6 flex gap-2 rounded-2xl border border-white/[.07] bg-white/[.025] p-1.5 w-fit">
        <button onClick={() => {setTab('clients');setSelected(null);}} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${tab==='clients'?'bg-gradient-to-r from-amber-300/20 to-amber-500/10 text-amber-100 shadow-inner':'text-slate-400 hover:text-white'}`}><Users size={16}/> Clientes <span className="text-xs opacity-60">{clients.length}</span></button>
        <button onClick={() => {setTab('suppliers');setSelected(null);}} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${tab==='suppliers'?'bg-gradient-to-r from-amber-300/20 to-amber-500/10 text-amber-100 shadow-inner':'text-slate-400 hover:text-white'}`}><Building2 size={16}/> Fornecedores <span className="text-xs opacity-60">{suppliers.length}</span></button>
      </div>
      {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-200"><AlertCircle size={16}/>{error}</div>}
      {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.025] p-10 text-center text-slate-400">A sincronizar dados do CRM…</div> :
      tab==='clients' ? <>
      <section className="mb-5 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Alertas de validade de documentos</h2><p className="mt-1 text-xs text-slate-400">Documentos expirados ou a expirar nos próximos 30 dias.</p></div><span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs text-amber-100">{documentAlerts.length} alertas</span></div>
        {documentAlerts.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{documentAlerts.map(a=><button key={a.cliente_id} onClick={()=>void openClient(a.cliente_id)} className="rounded-xl border border-white/[.08] bg-black/20 p-3 text-left hover:border-amber-300/30"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-white">{a.nome}</span><span className={a.estado_documento==='expirado'?'rounded-full bg-rose-400/10 px-2 py-1 text-[10px] text-rose-200':'rounded-full bg-amber-300/10 px-2 py-1 text-[10px] text-amber-100'}>{a.estado_documento==='expirado'?'Expirado':'A expirar'}</span></div><div className="mt-2 text-xs text-slate-400">Validade: {date(a.data_validade_documento)} · {a.dias_ate_validade < 0 ? `há ${Math.abs(a.dias_ate_validade)} dias` : `em ${a.dias_ate_validade} dias`}</div></button>)}</div> : <p className="text-sm text-slate-500">Não existem documentos expirados ou próximos do vencimento.</p>}
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(300px,390px)_1fr]">
        <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0d1523]/90 shadow-2xl shadow-black/20">
          <div className="border-b border-white/[.07] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-white">Base de clientes</span><span className="text-xs text-slate-500">{filtered.length} registos</span></div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search size={16} className="text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, NIF, telefone, email ou CC…" className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"/></div></div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {filtered.map(c=><button key={c.id} onClick={()=>void openClient(c.id)} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${selected===c.id?'border-amber-300/25 bg-amber-300/[.08]':'border-transparent hover:border-white/[.07] hover:bg-white/[.035]'}`}>
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/15 bg-amber-300/[.08] text-amber-200"><UserRound size={18}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-100">{c.nome}</div><div className="mt-1 truncate text-xs text-slate-500">{c.telemovel || c.email || c.bi_cc || 'Sem contacto registado'}</div></div><span className="text-[10px] text-slate-500">{c.total_transacoes || 0} tx</span></div>
              <div className="mt-3 flex justify-between text-xs"><span className="text-slate-500">{c.loja_nome || 'Cliente'}</span><span className="font-medium text-amber-100/80">{eur(c.total_volume)}</span></div>
            </button>)}
            {!filtered.length && <div className="p-8 text-center text-sm text-slate-500">Não foram encontrados clientes.</div>}
          </div>
        </section>
        <section className="min-w-0">
          {!selected && <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[.07] text-amber-200"><Users size={26}/></div><h2 className="text-lg font-semibold text-white">Ficha 360° do cliente</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Escolha um cliente para consultar os seus dados, transações, artigos e documentos associados.</p></div>}
          {detailLoading && <div className="rounded-2xl border border-white/10 bg-white/[.025] p-10 text-center text-slate-400">A carregar ficha e histórico…</div>}
          {detail && <div className="space-y-4">
            <div className="rounded-2xl border border-white/[.08] bg-gradient-to-br from-[#172235] to-[#0d1523] p-5 shadow-xl shadow-black/20 sm:p-7">
              <button onClick={()=>{setSelected(null);setDetail(null);}} className="mb-5 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-amber-200"><ArrowLeft size={14}/> Voltar à lista</button>
              <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Perfil de cliente</div><h2 className="mt-2 text-2xl font-semibold text-white">{detail.client.nome}</h2><p className="mt-1 text-sm text-slate-400">{detail.client.morada || 'Morada não registada'}</p></div><div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-2 text-xs text-emerald-200">Ficha protegida</div></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[['NIF',detail.client.nif || '—'],['Telemóvel',detail.client.telemovel || detail.client.contacto || '—'],['Email',detail.client.email || '—'],['Identificação',detail.client.tipo_documento || 'Documento']].map(([k,v])=><div key={k} className="rounded-xl border border-white/[.07] bg-black/15 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div><div className="mt-1 break-words text-sm text-slate-200">{v}</div></div>)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[.08] bg-[#0d1523] p-4"><div className="text-xs text-slate-500">Transações no histórico</div><div className="mt-2 text-2xl font-semibold text-white">{detail.transactions.length}</div></div>
              <div className="rounded-xl border border-white/[.08] bg-[#0d1523] p-4"><div className="text-xs text-slate-500">Volume com valor registado</div><div className="mt-2 text-2xl font-semibold text-amber-100">{eur(detail.transactions.reduce((s,t)=>s+(Number(t.valor_final)||0),0))}</div></div>
              <div className="rounded-xl border border-white/[.08] bg-[#0d1523] p-4"><div className="text-xs text-slate-500">Artigos associados</div><div className="mt-2 text-2xl font-semibold text-white">{detail.articles.length}</div></div>
            </div>
            <div className="rounded-2xl border border-white/[.08] bg-[#0d1523] p-5">
              <div className="mb-4 flex items-center gap-2"><Clock3 size={17} className="text-amber-200"/><h3 className="font-semibold text-white">Histórico de transações</h3></div>
              {!detail.transactions.length && <p className="py-8 text-center text-sm text-slate-500">Ainda não existem transações associadas a esta ficha.</p>}
              {detail.transactions.map(tx=><div key={tx.id} className="mb-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4 last:mb-0">
                <div className="flex flex-wrap justify-between gap-2"><div><div className="text-sm font-semibold text-white">{tx.tipo_peca || tx.metal || 'Transação'}</div><div className="mt-1 text-xs text-slate-500">{date(tx.created_at)} · {tx.loja_nome || 'Loja não identificada'}</div></div><div className="text-right"><div className="font-semibold text-amber-100">{eur(tx.valor_final)}</div><div className="mt-1 text-xs text-slate-500">{tx.estado || 'Estado indisponível'}</div></div></div>
                {tx.origem_ligacao==='nome_nao_confirmado' && <div className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[.05] px-3 py-2 text-xs text-amber-100/80">Correspondência pelo nome; associação ainda não confirmada. Não foi alterado qualquer registo.</div>}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><Scale size={13}/>{tx.peso_gramas ?? '—'} g</span><span className="inline-flex items-center gap-1"><Coins size={13}/>{tx.metal || 'Metal não indicado'}</span></div>
                {(articlesByTx.get(tx.id)||[]).length>0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{(articlesByTx.get(tx.id)||[]).map(a=><div key={a.id} className="flex gap-3 rounded-lg border border-white/[.07] bg-black/15 p-3">{a.foto_signed_url ? <img src={a.foto_signed_url} alt={a.descricao || a.tipo || 'Artigo'} className="h-16 w-16 rounded-lg object-cover"/> : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/[.04] text-slate-600"><ImageIcon size={20}/></div>}<div className="min-w-0"><div className="truncate text-sm text-slate-200">{a.tipo || 'Artigo'}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{a.descricao || 'Sem descrição'}</div><div className="mt-1 text-xs text-amber-100/70">{a.peso_gramas ?? '—'} g · {a.quilates ?? '—'} K</div></div></div>)}</div>}
              </div>)}
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-[#0d1523] p-5">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-amber-200"/><h3 className="font-semibold text-white">Documento de identificação e validade</h3></div>
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-black/20 p-3"><div className="text-[10px] uppercase text-slate-500">Tipo</div><div className="mt-1 text-sm text-white">{detail.client.tipo_documento || '—'}</div></div>
                <div className="rounded-xl bg-black/20 p-3"><div className="text-[10px] uppercase text-slate-500">Emissão</div><div className="mt-1 text-sm text-white">{date(detail.client.data_emissao_documento)}</div></div>
                <div className="rounded-xl bg-black/20 p-3"><div className="text-[10px] uppercase text-slate-500">Validade</div><div className="mt-1 text-sm text-white">{date(detail.client.data_validade_documento)}</div></div>
              </div>
              <div className="mb-4 space-y-2">{detail.documents.map(doc=><div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-black/20 p-3"><div><div className="text-sm text-white">{doc.tipo_documento} · {doc.numero_documento}</div><div className="mt-1 text-xs text-slate-400">Validade {date(doc.data_validade)} · {doc.substituido_em ? 'Versão substituída' : 'Versão activa'} · {bytes(doc.tamanho_bytes)}</div></div>{doc.signed_url && <a href={doc.signed_url} target="_blank" rel="noreferrer" className="text-xs text-amber-200 hover:underline">Abrir digitalização</a>}</div>)}</div>
              <div className="border-t border-white/[.07] pt-4">
                <h4 className="mb-3 text-sm font-semibold text-white">Digitalizar / substituir documento</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">Tipo de documento<select value={documentType} onChange={e=>setDocumentType(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 text-sm text-white"><option value="cc">Cartão de Cidadão</option><option value="passaporte">Passaporte</option><option value="cartao_residente">Cartão de Residência</option><option value="outro">Outro</option></select></label>
                  <label className="text-xs text-slate-400">Número do documento<input value={documentNumber} onChange={e=>setDocumentNumber(e.target.value)} maxLength={80} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 text-sm text-white"/></label>
                  <label className="text-xs text-slate-400">Data de emissão<input type="date" value={documentIssueDate} onChange={e=>setDocumentIssueDate(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 text-sm text-white"/></label>
                  <label className="text-xs text-slate-400">Data de validade *<input type="date" required value={documentExpiryDate} onChange={e=>setDocumentExpiryDate(e.target.value)} min={new Date().toISOString().slice(0,10)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 text-sm text-white"/></label>
                  <label className="text-xs text-slate-400 sm:col-span-2">Digitalização (PDF, JPEG, PNG ou WebP; máximo 6 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setDocumentFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-300/10 file:px-3 file:py-2 file:text-amber-100"/></label>
                </div>
                <button type="button" disabled={documentSaving || !documentFile} onClick={()=>void uploadIdentityDocument()} className="mt-4 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{documentSaving?'A guardar…':'Guardar novo documento'}</button>
                <p className="mt-2 text-[11px] text-slate-500">A versão anterior fica arquivada no histórico. Os ficheiros permanecem privados e os links temporários expiram.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[.08] bg-[#0d1523] p-5">
              <div className="mb-4 flex items-center gap-2"><Paperclip size={17} className="text-amber-200"/><h3 className="font-semibold text-white">Documentos e anexos</h3><span className="ml-auto text-xs text-slate-500">{detail.attachments.length}</span></div>
              {!detail.attachments.length && <p className="py-5 text-center text-sm text-slate-500">Sem anexos associados a esta ficha.</p>}
              <div className="grid gap-2 sm:grid-cols-2">{detail.attachments.map(f=><a key={f.id} href={f.signed_url || undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3 hover:border-amber-300/20"><FileText size={19} className="shrink-0 text-amber-200"/><div className="min-w-0 flex-1"><div className="truncate text-sm text-slate-200">{f.nome_ficheiro}</div><div className="mt-1 text-xs text-slate-500">{f.categoria} · {bytes(f.tamanho_bytes)}</div></div></a>)}</div>
              <p className="mt-4 text-[11px] leading-5 text-slate-600">Os anexos são privados e os links de consulta expiram automaticamente.</p>
            </div>
          </div>}
        </section>
      </div></> : <section className="rounded-2xl border border-white/[.08] bg-[#0d1523]/90 p-5">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Base de fornecedores</h2><p className="mt-1 text-xs text-slate-500">Registos de fornecedores já existentes.</p></div><Building2 className="text-amber-200"/></div>
        {!suppliers.length && <div className="py-12 text-center text-sm text-slate-500">Ainda não existem fornecedores registados.</div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{suppliers.map(s=><div key={s.id} className="rounded-xl border border-white/[.07] bg-white/[.025] p-4"><div className="flex items-center justify-between"><div className="font-semibold text-white">{s.nome}</div><span className={`rounded-full px-2 py-1 text-[10px] ${s.ativo?'bg-emerald-300/10 text-emerald-200':'bg-slate-500/10 text-slate-400'}`}>{s.ativo?'Ativo':'Inativo'}</span></div><div className="mt-3 space-y-1 text-xs text-slate-400"><div>{s.nif || 'NIF não registado'}</div><div>{s.contacto || 'Contacto não registado'}</div><div>{s.email || 'Email não registado'}</div><div>{s.morada || 'Morada não registada'}</div></div></div>)}</div>
      </section>}
      <div className="mt-7 flex items-center gap-2 text-[10px] text-slate-600"><ShieldCheck size={13}/> Acesso administrativo autenticado · Consulta apenas de leitura nesta fase</div>
    </div>
  </div>;
};
