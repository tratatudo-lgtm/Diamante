import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, RefreshCw, TrendingUp, Wallet, Scale, Store } from 'lucide-react';

type StoreResult = {
  loja_id: string;
  loja_nome: string;
  revenue: number;
  allocated_cost: number;
  additional_costs: number;
  result: number;
  fine_gold_sold_grams: number;
  margin_percent: number | null;
};
type Report = {
  success: boolean;
  period: { from: string | null; to: string | null };
  totals: { revenue: number; allocated_cost: number; additional_costs: number; result: number; fine_gold_sold_grams: number };
  stores: StoreResult[];
  unmatched: { revenue: number; allocated_cost?: number; additional_costs?: number; result: number; fine_gold_sold_grams?: number };
};

const euro = (value: number) => Number(value || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const grams = (value: number) => Number(value || 0).toLocaleString('pt-PT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' g';

export const RefiningProfitabilityPage: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa não encontrada. Volte a iniciar sessão.');
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await fetch('/api/admin/refining/profitability?' + params.toString(), {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Não foi possível carregar o relatório.');
      setReport(payload as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar o relatório.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const totals = report?.totals;
  const cards = useMemo(() => [
    { label: 'Receita realizada', value: euro(totals?.revenue || 0), icon: Wallet },
    { label: 'Resultado realizado', value: euro(totals?.result || 0), icon: TrendingUp },
    { label: 'Custo imputado', value: euro(totals?.allocated_cost || 0), icon: Scale },
    { label: 'Ouro fino vendido', value: grams(totals?.fine_gold_sold_grams || 0), icon: Store },
  ], [totals]);

  return (
    <div className="min-h-screen bg-[#080d17] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4af37]">Diamante D’Ouro · Controlo de ouro</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Rentabilidade da fundição</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Resultados realizados das liquidações, atribuídos às lojas de origem das peças.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2.5 text-sm font-semibold text-[#f0d783] transition hover:bg-[#d4af37]/15 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-medium text-slate-400">Data inicial
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b1321] px-3 py-2.5">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none" />
            </span>
          </label>
          <label className="flex-1 text-xs font-medium text-slate-400">Data final
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b1321] px-3 py-2.5">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none" />
            </span>
          </label>
          <button onClick={() => void load()} disabled={loading || (!!from && !!to && from > to)} className="rounded-xl bg-[#d4af37] px-5 py-2.5 text-sm font-bold text-[#17130a] transition hover:bg-[#e5c45d] disabled:opacity-50">Aplicar período</button>
        </div>

        {error && <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}

        {loading && !report ? <div className="py-16 text-center text-sm text-slate-400">A carregar resultados...</div> : null}

        {report && <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(card => {
              const Icon = card.icon;
              return <div key={card.label} className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-5">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-400">{card.label}</span><Icon className="h-4 w-4 text-[#d4af37]" /></div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{card.value}</p>
              </div>;
            })}
          </div>

          <section className="mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="flex flex-col gap-1 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-semibold text-white">Desempenho por loja</h2><p className="mt-1 text-xs text-slate-500">Apenas vendas efectivamente liquidadas no período seleccionado.</p></div>
              <span className="text-xs text-slate-500">{report.stores.length} lojas com vendas</span>
            </div>
            {report.stores.length ? <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500"><tr>
                  <th className="px-5 py-3 font-semibold">Loja de origem</th><th className="px-4 py-3 text-right font-semibold">Ouro fino</th><th className="px-4 py-3 text-right font-semibold">Receita</th><th className="px-4 py-3 text-right font-semibold">Custo imputado</th><th className="px-4 py-3 text-right font-semibold">Custos adicionais</th><th className="px-5 py-3 text-right font-semibold">Resultado</th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.06]">{report.stores.map(row => <tr key={row.loja_id} className="transition hover:bg-white/[0.025]">
                  <td className="px-5 py-4 font-medium text-white">{row.loja_nome}<p className="mt-1 text-[10px] text-slate-500">{row.margin_percent == null ? 'Margem indisponível' : `Margem ${row.margin_percent.toLocaleString('pt-PT')}%`}</p></td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-300">{grams(row.fine_gold_sold_grams)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-300">{euro(row.revenue)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-300">{euro(row.allocated_cost)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-slate-300">{euro(row.additional_costs)}</td>
                  <td className={`px-5 py-4 text-right font-semibold tabular-nums ${row.result >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{euro(row.result)}</td>
                </tr>)}</tbody>
              </table>
            </div> : <div className="px-5 py-12 text-center text-sm text-slate-500">Não existem liquidações neste período.</div>}
          </section>

          {(report.unmatched.revenue > 0.009 || Math.abs(report.unmatched.result) > 0.009 || Number(report.unmatched.allocated_cost || 0) > 0.009 || Number(report.unmatched.additional_costs || 0) > 0.009 || Number(report.unmatched.fine_gold_sold_grams || 0) > 0.0009) && <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
            <p className="font-semibold">Valores por reconciliar</p><p className="mt-1 text-xs text-amber-100/70">Parte da receita e do resultado não pôde ser atribuída com segurança a uma loja de origem. Receita: {euro(report.unmatched.revenue)} · Custo imputado: {euro(report.unmatched.allocated_cost || 0)} · Custos adicionais: {euro(report.unmatched.additional_costs || 0)} · Resultado: {euro(report.unmatched.result)} · Ouro fino: {grams(report.unmatched.fine_gold_sold_grams || 0)}.</p>
          </div>}
          <p className="mt-4 text-[11px] text-slate-600">Este relatório apresenta resultados realizados. Não inclui valorização estimada do ouro fino ainda disponível para venda.</p>
        </>}
      </div>
    </div>
  );
};

export default RefiningProfitabilityPage;
