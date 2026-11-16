import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Factory, RefreshCw, Scale, ShieldCheck } from 'lucide-react';

interface EligiblePiece {
  id: string; codigo_unico: string; metal: string; tipo_peca?: string | null;
  peso_recebido_gramas: number; peso_gramas: number; diferenca_peso_gramas?: number | null;
  data_rececao?: string | null;
}
interface RefiningBatch {
  id: string; codigo_lote: string; estado: 'em_preparacao' | 'concluido';
  quantidade_pecas: number; peso_entrada_gramas: number; custo_aquisicao_total?: number | null;
  custo_por_grama_fino?: number | null; custo_operacional_total?: number | null; custo_total?: number | null; custos_operacionais?: Array<{categoria:string;descricao:string;valor:number}>; valor_referencia_ouro_fino?: number | null; margem_potencial?: number | null; peso_recuperado_gramas?: number | null; toque_milesimos?: number | null;
  ouro_fino_recuperado_gramas?: number | null; perda_processo_gramas?: number | null;
  rendimento_percentagem?: number | null; criado_em: string;
  ouro_fino_vendido_gramas?: number; receita_realizada?: number; resultado_realizado?: number;
  liquidacoes?: Array<{ id: string; ouro_fino_vendido_gramas: number; preco_por_grama: number; receita_bruta: number; resultado_liquido: number; comprador: string; referencia_documento?: string | null; liquidado_em: string }>;
  pecas?: Array<{ inventario_id: string; codigo_peca: string; peso_recebido_gramas: number; custo_aquisicao?: number | null; transacao_origem_id?: string | null }>;
}

export const GoldRefiningPage: React.FC = () => {
  const [pieces, setPieces] = useState<EligiblePiece[]>([]);
  const [batches, setBatches] = useState<RefiningBatch[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [recovered, setRecovered] = useState<Record<string, string>>({});
  const [touch, setTouch] = useState<Record<string, string>>({});
  const [costForms, setCostForms] = useState<Record<string, {categoria:string;descricao:string;valor:string}>>({});
  const [saleForms, setSaleForms] = useState<Record<string, {gramas:string;preco:string;custos:string;comprador:string;documento:string}>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
      const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token };
      const [pRes, bRes] = await Promise.all([
        fetch('/api/admin/refining/eligible', { headers, signal: AbortSignal.timeout(15000) }),
        fetch('/api/admin/refining/batches', { headers, signal: AbortSignal.timeout(15000) }),
      ]);
      const [pData, bData] = await Promise.all([pRes.json(), bRes.json()]);
      if (!pRes.ok || pData?.success !== true || !Array.isArray(pData.data)) throw new Error(pData?.error || 'Não foi possível carregar peças recebidas.');
      if (!bRes.ok || bData?.success !== true || !Array.isArray(bData.data)) throw new Error(bData?.error || 'Não foi possível carregar lotes.');
      setPieces(pData.data); setBatches(bData.data);
      setSelected(current => current.filter(id => pData.data.some((p: EligiblePiece) => p.id === id)));
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar fundição.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedWeight = useMemo(() => pieces.filter(p => selected.includes(p.id)).reduce((s,p) => s + Number(p.peso_recebido_gramas || 0), 0), [pieces, selected]);
  const pendingBatches = batches.filter(b => b.estado === 'em_preparacao').length;
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);

  const createBatch = async () => {
    if (!selected.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const response = await fetch('/api/admin/refining/batches', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ inventario_ids: selected }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'Não foi possível criar o lote.');
      setSelected([]); setNotice('Lote ' + (payload.lote?.codigo_lote || '') + ' criado. As peças ficaram reservadas para este lote.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar lote.'); }
    finally { setBusy(false); }
  };

  const addOperationalCost = async (batch: RefiningBatch) => {
    const form = costForms[batch.id] || { categoria: 'fundicao', descricao: '', valor: '' };
    setBusy(true); setError(''); setNotice('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const response = await fetch('/api/admin/refining/batches/' + encodeURIComponent(batch.id) + '/costs', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ categoria: form.categoria, descricao: form.descricao, valor: form.valor.replace(',', '.') }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'Não foi possível registar o custo.');
      setCostForms(v => ({ ...v, [batch.id]: { categoria: 'fundicao', descricao: '', valor: '' } }));
      setNotice('Custo operacional registado no lote ' + batch.codigo_lote + '.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao registar custo.'); }
    finally { setBusy(false); }
  };

  const completeBatch = async (batch: RefiningBatch) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const response = await fetch('/api/admin/refining/batches/' + encodeURIComponent(batch.id) + '/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ peso_recuperado_gramas: (recovered[batch.id] || '').replace(',', '.'), toque_milesimos: (touch[batch.id] || '').replace(',', '.') }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'Não foi possível concluir o lote.');
      setNotice('Lote ' + batch.codigo_lote + ' concluído. Ouro fino recuperado: ' + Number(payload.lote?.ouro_fino_recuperado_gramas || 0).toFixed(3) + ' g.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao concluir lote.'); }
    finally { setBusy(false); }
  };

  const registerSettlement = async (batch: RefiningBatch) => {
    const form = saleForms[batch.id] || { gramas: '', preco: '', custos: '0', comprador: '', documento: '' };
    setBusy(true); setError(''); setNotice('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const response = await fetch('/api/admin/refining/batches/' + encodeURIComponent(batch.id) + '/settlements', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          chave_idempotencia: crypto.randomUUID(),
          ouro_fino_vendido_gramas: form.gramas.replace(',', '.'),
          preco_por_grama: form.preco.replace(',', '.'),
          custos_adicionais: form.custos.replace(',', '.'),
          comprador: form.comprador, referencia_documento: form.documento,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'Não foi possível registar a liquidação.');
      setSaleForms(v => ({ ...v, [batch.id]: { gramas: '', preco: '', custos: '0', comprador: '', documento: '' } }));
      setNotice('Venda real registada para o lote ' + batch.codigo_lote + '. Receita: ' + Number(payload.liquidacao?.receita_bruta || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) + '.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao registar venda.'); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-[#080d17] px-4 py-6 text-white sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4af37]">Sede · Metalurgia e controlo</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Lotes de Fundição</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Agrupe peças recebidas, registe o ouro recuperado e acompanhe o rendimento real de cada lote.</p></div>
        <button onClick={() => void load()} disabled={loading || busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold disabled:opacity-50"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')}/> Actualizar</button>
      </header>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4"><p className="text-xs text-slate-400">Peças recebidas elegíveis</p><p className="mt-2 text-2xl font-bold">{pieces.length}</p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4"><p className="text-xs text-slate-400">Peso recebido disponível</p><p className="mt-2 text-2xl font-bold">{pieces.reduce((s,p)=>s+Number(p.peso_recebido_gramas||0),0).toFixed(3)} <span className="text-sm text-slate-400">g</span></p></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4"><p className="text-xs text-slate-400">Lotes em preparação</p><p className="mt-2 text-2xl font-bold">{pendingBatches}</p></div>
      </div>
      {error && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</div>}
      {notice && <div role="status" className="mt-5 flex gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0"/>{notice}</div>}
      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Peças prontas para fundição</h2><p className="mt-1 text-xs text-slate-400">Apenas peças recebidas e pesadas na sede.</p></div><div className="text-right"><p className="text-xs text-slate-400">Selecção: {selected.length} peças</p><p className="text-sm font-bold">{selectedWeight.toFixed(3)} g</p></div></div>
        <div className="mt-3 space-y-2">
          {loading ? <div className="rounded-xl bg-[#101827] p-8 text-center text-sm text-slate-400">A carregar...</div> : pieces.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">Não existem peças recebidas disponíveis para um novo lote.</div> : pieces.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-[#101827] p-3 hover:border-[#d4af37]/40"><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} className="h-4 w-4 accent-[#d4af37]"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.codigo_unico}</span><span className="block text-[11px] text-slate-500">{p.metal}{p.tipo_peca ? ' · '+p.tipo_peca : ''}</span></span><span className="text-right"><span className="block text-sm font-bold tabular-nums">{Number(p.peso_recebido_gramas).toFixed(3)} g</span><span className="block text-[10px] text-slate-500">recebido na sede</span></span></label>)}
        </div>
        <button disabled={!selected.length || busy} onClick={()=>void createBatch()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b98724] px-5 text-xs font-black text-[#17120a] disabled:opacity-40"><Factory className="h-4 w-4"/> Criar lote com {selected.length} peças</button>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-bold">Histórico de lotes</h2><p className="mt-1 text-xs text-slate-400">Os resultados finais ficam bloqueados após a conclusão.</p>
        <div className="mt-3 space-y-3">
          {batches.map(b => <article key={b.id} className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{b.codigo_lote}</h3><p className="mt-1 text-[11px] text-slate-500">{b.quantidade_pecas} peças · criado em {new Date(b.criado_em).toLocaleString('pt-PT')}</p></div><span className={'rounded-md px-2 py-1 text-[10px] font-bold ' + (b.estado === 'concluido' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300')}>{b.estado === 'concluido' ? 'Concluído' : 'Em preparação'}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><p className="text-slate-500">Entrada</p><p className="mt-1 font-bold">{Number(b.peso_entrada_gramas).toFixed(3)} g</p></div><div><p className="text-slate-500">Custo de aquisição</p><p className="mt-1 font-bold">{Number(b.custo_aquisicao_total || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</p></div>{b.estado === 'concluido' && <><div><p className="text-slate-500">Custo total</p><p className="mt-1 font-bold">{Number(b.custo_total ?? b.custo_aquisicao_total ?? 0).toLocaleString('pt-PT', {style:'currency',currency:'EUR'})}</p></div><div><p className="text-slate-500">Custo / g fino</p><p className="mt-1 font-bold text-[#d4af37]">{b.custo_por_grama_fino == null ? '—' : Number(b.custo_por_grama_fino).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p></div><div><p className="text-slate-500">Recuperado</p><p className="mt-1 font-bold">{Number(b.peso_recuperado_gramas).toFixed(3)} g</p></div><div><p className="text-slate-500">Ouro fino</p><p className="mt-1 font-bold text-emerald-300">{Number(b.ouro_fino_recuperado_gramas).toFixed(3)} g</p></div><div><p className="text-slate-500">Perda / Rendimento</p><p className="mt-1 font-bold">{Number(b.perda_processo_gramas).toFixed(3)} g / {Number(b.rendimento_percentagem).toFixed(2)}%</p></div></>}</div>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Peças incluídas · origem preservada</p><div className="mt-2 flex flex-wrap gap-2">{(b.pecas || []).map(piece => <span key={piece.inventario_id} title={piece.transacao_origem_id ? 'Compra: ' + piece.transacao_origem_id : 'Origem da compra não disponível'} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300">{piece.codigo_peca} · {Number(piece.peso_recebido_gramas).toFixed(3)} g · {Number(piece.custo_aquisicao || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span>)}</div></div>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Custos operacionais</p><p className="text-xs font-bold">{Number(b.custo_operacional_total || 0).toLocaleString('pt-PT', {style:'currency',currency:'EUR'})}</p></div>
              {(b.custos_operacionais || []).map((cost, index) => <div key={index} className="mt-2 flex justify-between gap-3 text-xs text-slate-300"><span>{cost.categoria} · {cost.descricao}</span><span className="font-semibold">{Number(cost.valor).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})}</span></div>)}
              {b.estado === 'em_preparacao' && <div className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr_110px_auto]">
                <select value={(costForms[b.id] || {categoria:'fundicao'}).categoria} onChange={e=>setCostForms(v=>({...v,[b.id]:{...(v[b.id]||{descricao:'',valor:''}),categoria:e.target.value}}))} className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"><option value="transporte">Transporte</option><option value="analise">Análise</option><option value="fundicao">Fundição</option><option value="outro">Outro</option></select>
                <input value={(costForms[b.id] || {descricao:''}).descricao} onChange={e=>setCostForms(v=>({...v,[b.id]:{...(v[b.id]||{categoria:'fundicao',valor:''}),descricao:e.target.value}}))} placeholder="Descrição do custo" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <input value={(costForms[b.id] || {valor:''}).valor} onChange={e=>setCostForms(v=>({...v,[b.id]:{...(v[b.id]||{categoria:'fundicao',descricao:''}),valor:e.target.value}}))} inputMode="decimal" placeholder="Valor €" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <button disabled={busy} onClick={()=>void addOperationalCost(b)} className="h-9 rounded-lg bg-[#d4af37]/15 px-3 text-xs font-bold text-[#e4c65b] disabled:opacity-40">Adicionar custo</button>
              </div>}
              <p className="mt-2 text-[10px] text-slate-500">Total do lote: {Number(b.custo_total ?? b.custo_aquisicao_total ?? 0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})} · inclui aquisição e custos operacionais. O custo por grama fina só é calculado após a conclusão.</p>
            </div>
            {b.estado === 'concluido' && <div className="mt-4 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/[0.04] p-3">
              <div className="flex flex-wrap justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">Venda e liquidação real</p><p className="mt-1 text-xs text-slate-400">Disponível: {Math.max(0, Number(b.ouro_fino_recuperado_gramas || 0) - Number(b.ouro_fino_vendido_gramas || 0)).toFixed(3)} g de ouro fino</p></div><div className="text-right text-xs"><p>Receita: <strong>{Number(b.receita_realizada || 0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})}</strong></p><p>Resultado realizado: <strong className={Number(b.resultado_realizado || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{Number(b.resultado_realizado || 0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})}</strong></p></div></div>
              {Number(b.ouro_fino_recuperado_gramas || 0) > Number(b.ouro_fino_vendido_gramas || 0) && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <input value={(saleForms[b.id] || {gramas:''}).gramas} onChange={e=>setSaleForms(v=>({...v,[b.id]:{...(v[b.id]||{preco:'',custos:'0',comprador:'',documento:''}),gramas:e.target.value}}))} inputMode="decimal" placeholder="Ouro fino vendido (g)" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <input value={(saleForms[b.id] || {preco:''}).preco} onChange={e=>setSaleForms(v=>({...v,[b.id]:{...(v[b.id]||{gramas:'',custos:'0',comprador:'',documento:''}),preco:e.target.value}}))} inputMode="decimal" placeholder="Preço efectivo €/g" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <input value={(saleForms[b.id] || {custos:'0'}).custos} onChange={e=>setSaleForms(v=>({...v,[b.id]:{...(v[b.id]||{gramas:'',preco:'',comprador:'',documento:''}),custos:e.target.value}}))} inputMode="decimal" placeholder="Custos adicionais €" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <input value={(saleForms[b.id] || {comprador:''}).comprador} onChange={e=>setSaleForms(v=>({...v,[b.id]:{...(v[b.id]||{gramas:'',preco:'',custos:'0',documento:''}),comprador:e.target.value}}))} placeholder="Comprador / refinador" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <input value={(saleForms[b.id] || {documento:''}).documento} onChange={e=>setSaleForms(v=>({...v,[b.id]:{...(v[b.id]||{gramas:'',preco:'',custos:'0',comprador:''}),documento:e.target.value}}))} placeholder="Documento / referência" className="h-9 rounded-lg border border-white/10 bg-[#080d17] px-2 text-xs"/>
                <button disabled={busy} onClick={()=>void registerSettlement(b)} className="h-9 rounded-lg bg-[#d4af37] px-3 text-xs font-black text-[#17120a] disabled:opacity-40 sm:col-span-2 lg:col-span-5">Registar venda / liquidação</button>
              </div>}
              {(b.liquidacoes || []).map(sale => <div key={sale.id} className="mt-3 flex flex-wrap justify-between gap-2 border-t border-white/[0.06] pt-2 text-[11px] text-slate-300"><span>{new Date(sale.liquidado_em).toLocaleString('pt-PT')} · {sale.comprador} · {Number(sale.ouro_fino_vendido_gramas).toFixed(3)} g × {Number(sale.preco_por_grama).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})}/g</span><span className="font-semibold">{Number(sale.receita_bruta).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})} · Resultado {Number(sale.resultado_liquido).toLocaleString('pt-PT',{style:'currency',currency:'EUR'})}</span></div>)}
            </div>}
            {b.estado === 'em_preparacao' && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"><label><span className="mb-1 block text-[11px] text-slate-400">Peso recuperado (g)</span><input value={recovered[b.id] || ''} onChange={e=>setRecovered(v=>({...v,[b.id]:e.target.value}))} inputMode="decimal" placeholder="Ex.: 48,250" className="h-10 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 text-sm"/></label><label><span className="mb-1 block text-[11px] text-slate-400">Toque final (‰)</span><input value={touch[b.id] || ''} onChange={e=>setTouch(v=>({...v,[b.id]:e.target.value}))} inputMode="decimal" placeholder="Ex.: 999,9" className="h-10 w-full rounded-lg border border-white/10 bg-[#080d17] px-3 text-sm"/></label><button disabled={busy} onClick={()=>void completeBatch(b)} className="h-10 rounded-lg bg-emerald-500/15 px-4 text-xs font-bold text-emerald-300 disabled:opacity-40"><ShieldCheck className="mr-1 inline h-4 w-4"/> Concluir lote</button></div>}
          </article>)}
          {!loading && batches.length === 0 && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">Ainda não existem lotes registados.</div>}
        </div>
      </section>
      <p className="mt-8 text-[10px] leading-relaxed text-slate-600">O ouro fino é calculado como peso recuperado × toque ÷ 1000. A perda é a diferença entre peso de entrada e peso recuperado. Estes indicadores não substituem a reconciliação laboratorial nem a avaliação do custo de aquisição.</p>
    </div>
  </div>;
};
export default GoldRefiningPage;
