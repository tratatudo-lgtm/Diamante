import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, RefreshCw, Scale } from 'lucide-react';

interface MovementItem {
  id: string;
  evento: 'expedicao_sede' | 'recepcao_sede' | 'entrada_fundicao';
  codigo_peca: string;
  loja_nome?: string | null;
  peso_declarado_gramas?: number | null;
  peso_recebido_gramas?: number | null;
  diferenca_peso_gramas?: number | null;
  ocorrido_em: string;
  observacoes?: string | null;
  divergencia: boolean;
  codigo_lote_fundicao?: string | null;
}

interface ReceivingItem {
  id: string;
  codigo_unico: string;
  loja_atual_id: string;
  loja_origem_nome: string;
  transacao_origem_id?: string | null;
  tipo_peca?: string | null;
  metal: string;
  peso_gramas: number;
  estado: string;
  data_saida?: string | null;
}

export const GoldReceivingPage: React.FC = () => {
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [movementHistory, setMovementHistory] = useState<MovementItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
      const response = await fetch('/api/admin/inventory/receiving', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.data)) {
        throw new Error(payload?.error || 'Não foi possível carregar as peças expedidas.');
      }
      setItems(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a recepção.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
      const response = await fetch('/api/admin/inventory/movements?limit=100', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.data)) {
        throw new Error(payload?.error || 'Não foi possível carregar o histórico.');
      }
      setMovementHistory(payload.data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Erro ao carregar histórico.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showHistory) void loadHistory(); }, [showHistory, loadHistory]);

  const receive = async (item: ReceivingItem) => {
    const rawWeight = weights[item.id] ?? String(item.peso_gramas);
    const weight = Number(rawWeight.replace(',', '.'));
    if (!Number.isFinite(weight) || weight <= 0) {
      setError('Introduza um peso recebido válido em gramas.');
      return;
    }
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
      const response = await fetch(`/api/admin/inventory/${encodeURIComponent(item.id)}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ peso_recebido_gramas: weight, observacoes_rececao: notes[item.id] || '' }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) throw new Error(payload?.error || 'Não foi possível confirmar a recepção.');
      setItems(current => current.filter(entry => entry.id !== item.id));
      setNotice(`Peça ${item.codigo_unico} recebida. Diferença: ${Number(payload.item?.diferenca_peso_gramas || 0).toFixed(3)} g.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar a recepção.');
    } finally {
      setBusyId(null);
    }
  };

  const totalWeight = items.reduce((sum, item) => sum + (Number(item.peso_gramas) || 0), 0);

  return (
    <div className="min-h-screen bg-[#080d17] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4af37]">Operações · Controlo físico</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Recepção de Ouro na Sede</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Conferência independente do peso declarado pelas lojas antes da entrada no circuito de fundição.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar lista
          </button>
          <button type="button" onClick={() => setShowHistory(value => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 text-xs font-semibold text-[#e7c76a] transition hover:bg-[#d4af37]/15">
            {showHistory ? 'Ocultar histórico' : 'Consultar histórico físico'}
          </button>
        </div>

        {showHistory && <section className="mt-6 rounded-2xl border border-white/[0.09] bg-[#101827] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-bold">Histórico de movimentos físicos</h2><p className="mt-1 text-xs text-slate-400">Últimos 100 registos de expedição e recepção, por ordem cronológica inversa.</p></div>
            <button type="button" onClick={() => void loadHistory()} disabled={historyLoading} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50">{historyLoading ? 'A actualizar...' : 'Actualizar histórico'}</button>
          </div>
          {historyError && <p role="alert" className="mt-3 text-sm text-rose-300">{historyError}</p>}
          {historyLoading ? <p className="py-8 text-center text-sm text-slate-400">A carregar histórico...</p> :
            movementHistory.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Ainda não existem movimentos registados.</p> :
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-3 pr-3">Data</th><th className="pb-3 pr-3">Peça</th><th className="pb-3 pr-3">Movimento</th><th className="pb-3 pr-3">Loja</th><th className="pb-3 pr-3 text-right">Declarado</th><th className="pb-3 pr-3 text-right">Recebido</th><th className="pb-3 text-right">Diferença</th></tr></thead>
              <tbody>{movementHistory.map(event => <tr key={event.id} className="border-t border-white/[0.06]">
                <td className="py-3 pr-3 text-slate-400">{new Date(event.ocorrido_em).toLocaleString('pt-PT')}</td>
                <td className="py-3 pr-3 font-semibold text-white">{event.codigo_peca}</td>
                <td className="py-3 pr-3 text-slate-300">{event.evento === 'expedicao_sede' ? 'Expedição' : event.evento === 'recepcao_sede' ? 'Recepção' : 'Entrada em fundição'}</td>
                <td className="py-3 pr-3 text-slate-400">{event.codigo_lote_fundicao || event.loja_nome || '—'}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{event.peso_declarado_gramas == null ? '—' : Number(event.peso_declarado_gramas).toFixed(3) + ' g'}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{event.peso_recebido_gramas == null ? '—' : Number(event.peso_recebido_gramas).toFixed(3) + ' g'}</td>
                <td className={`py-3 text-right font-semibold tabular-nums ${event.divergencia ? 'text-amber-300' : 'text-slate-300'}`}>{event.diferenca_peso_gramas == null ? '—' : (Number(event.diferenca_peso_gramas) > 0 ? '+' : '') + Number(event.diferenca_peso_gramas).toFixed(3) + ' g'}{event.divergencia ? ' · Rever' : ''}</td>
              </tr>)}</tbody>
            </table></div>}
        </section>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400"><PackageCheck className="h-4 w-4 text-[#d4af37]" /> Peças por receber</div>
            <p className="mt-3 text-2xl font-bold tabular-nums">{items.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400"><Scale className="h-4 w-4 text-[#d4af37]" /> Peso declarado</div>
            <p className="mt-3 text-2xl font-bold tabular-nums">{totalWeight.toFixed(3)} <span className="text-sm font-medium text-slate-400">g</span></p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#101827] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 className="h-4 w-4 text-[#d4af37]" /> Estado do circuito</div>
            <p className="mt-3 text-sm font-bold">{items.length ? 'A aguardar conferência física' : 'Sem peças pendentes'}</p>
          </div>
        </div>

        {error && <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

        <div className="mt-6 space-y-4">
          {loading ? <div className="rounded-2xl border border-white/10 bg-[#101827] p-10 text-center text-sm text-slate-400">A carregar expedições...</div> :
            items.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-[#101827]/60 p-12 text-center"><PackageCheck className="mx-auto h-8 w-8 text-emerald-400" /><p className="mt-3 font-semibold">Tudo conferido</p><p className="mt-1 text-sm text-slate-400">Não existem peças expedidas por receber.</p></div> :
            items.map(item => {
              const declared = Number(item.peso_gramas) || 0;
              const entered = Number((weights[item.id] ?? String(declared)).replace(',', '.'));
              const difference = Number.isFinite(entered) ? entered - declared : 0;
              const requiresNote = Math.abs(difference) > 0.05;
              return <article key={item.id} className="rounded-2xl border border-white/[0.09] bg-[#101827] p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold">{item.codigo_unico}</h2><span className="rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-300">Enviado à sede</span></div>
                    <p className="mt-1 text-xs text-slate-400">{item.loja_origem_nome} · {item.metal}{item.tipo_peca ? ` · ${item.tipo_peca}` : ''}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Expedição: {item.data_saida ? new Date(item.data_saida).toLocaleString('pt-PT') : 'Data não disponível'}</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Peso declarado</p><p className="text-lg font-bold tabular-nums">{declared.toFixed(3)} g</p></div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(150px,0.7fr)_minmax(200px,1fr)_auto] md:items-end">
                  <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Peso recebido (g)</span><input inputMode="decimal" value={weights[item.id] ?? String(declared)} onChange={e => setWeights(current => ({ ...current, [item.id]: e.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#080d17] px-3 text-sm font-semibold text-white outline-none focus:border-[#d4af37]" /></label>
                  <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Observações {requiresNote ? '(obrigatório)' : '(opcional)'}</span><input value={notes[item.id] || ''} onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} placeholder="Ex.: diferença confirmada na balança..." className="h-11 w-full rounded-xl border border-white/10 bg-[#080d17] px-3 text-sm text-white outline-none focus:border-[#d4af37]" /></label>
                  <button type="button" disabled={busyId === item.id} onClick={() => void receive(item)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b98724] px-4 text-xs font-black text-[#17120a] transition hover:brightness-110 disabled:opacity-50">{busyId === item.id ? 'A registar...' : 'Confirmar recepção'}</button>
                </div>
                <p className={`mt-3 text-xs tabular-nums ${Math.abs(difference) > 0.05 ? 'text-amber-300' : 'text-slate-500'}`}>Diferença calculada: {difference >= 0 ? '+' : ''}{difference.toFixed(3)} g {requiresNote ? '· requer justificação' : '· dentro da tolerância'}</p>
              </article>;
            })}
        </div>
        <p className="mt-6 text-[10px] leading-relaxed text-slate-600">A confirmação é registada uma única vez por peça. Diferenças superiores a 0,05 g exigem observação. A recepção não altera o peso original declarado pela loja.</p>
      </div>
    </div>
  );
};

export default GoldReceivingPage;
