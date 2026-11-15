import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, RefreshCw, Search, ReceiptText, CheckCircle2, Loader2 } from 'lucide-react';

type TransactionStatus = 'rascunho' | 'pendente_aprovacao' | 'aprovado' | 'pago' | string;

interface AdminTransaction {
  id: string;
  loja_id: string;
  loja_nome?: string;
  estado: TransactionStatus;
  valor_final: number | null;
  peso_gramas: number | null;
  created_at: string;
  cliente_nome?: string | null;
  primeira_aprovacao_por?: string | null;
  data_primeira_aprovacao?: string | null;
}

interface AdminTransactionsPageProps {
  onNavigate: (path: string) => void;
  initialStatus?: 'todos' | 'pendente_aprovacao' | 'aprovado';
}

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  pago: 'Pago',
};

export const AdminTransactionsPage: React.FC<AdminTransactionsPageProps> = ({
  onNavigate,
  initialStatus = 'todos',
}) => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadTransactions = async () => {
    setRefreshing(true);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa não encontrada. Inicia sessão novamente.');
      const response = await fetch('/api/admin/transactions?limit=200', {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Não foi possível carregar as transações.');
      }
      setTransactions(Array.isArray(payload.data) ? payload.data : []);
      setTotal(Number(payload.total) || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar transações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const approveTransaction = async (transactionId: string) => {
    if (approvingId) return;
    setApprovingId(transactionId);
    setError(null);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa não encontrada. Inicia sessão novamente.');
      const response = await fetch('/api/v1/admin/dashboard/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId }),
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Não foi possível aprovar esta compra.');
      }
      if (payload?.requiresSecondApproval) {
        setError(payload.message || 'Primeira assinatura registada. Falta a segunda assinatura de outro administrador.');
      }
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar a compra.');
    } finally {
      setApprovingId(null);
    }
  };

  useEffect(() => {
    void loadTransactions();
  }, []);

  const filteredTransactions = useMemo(() => transactions.filter((tx) => {
    if (status !== 'todos' && tx.estado !== status) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLocaleLowerCase('pt-PT');
    return [tx.id, tx.loja_nome, tx.estado, tx.cliente_nome]
      .some((value) => String(value || '').toLocaleLowerCase('pt-PT').includes(q));
  }), [transactions, status, search]);

  const money = (value: number | null) => value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value));
  const date = (value: string) => new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value));

  const statusClass = (value: string) => {
    if (value === 'aprovado' || value === 'pago') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (value === 'pendente_aprovacao') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    if (value === 'rascunho') return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
    return 'border-slate-700 bg-slate-800 text-slate-300';
  };

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button onClick={() => onNavigate('/dashboard-admin')} className="mb-3 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-[#E6C56A]">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Centro de Comando
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3 text-[#E6C56A]">
                <ReceiptText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Centro de Transações</h1>
                <p className="mt-1 text-xs text-slate-400">Consulta e aprovação de compras pendentes</p>
              </div>
            </div>
          </div>
          <button onClick={() => void loadTransactions()} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-slate-200 transition hover:border-[#D4AF37]/50 hover:text-[#E6C56A] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#151e30] via-[#101827] to-[#0d1422] p-4 shadow-2xl shadow-black/20 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Registos encontrados</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{total}</p>
              <p className="text-xs text-slate-500">A lista apresenta até 200 registos mais recentes.</p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar ID, loja ou estado..." className="h-11 w-full rounded-xl border border-slate-700 bg-[#080d18]/80 pl-10 pr-3 text-sm text-white outline-none transition focus:border-[#D4AF37]" />
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {([
              ['todos', 'Todas'],
              ['pendente_aprovacao', 'Pendentes'],
              ['aprovado', 'Aprovadas'],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setStatus(value)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${status === value ? 'border-[#D4AF37]/60 bg-[#D4AF37]/15 text-[#F2D98B] shadow-lg shadow-[#D4AF37]/5' : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          {error && <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-800/70" />)}</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
              <ReceiptText className="mx-auto mb-3 h-8 w-8 text-slate-600" />
              <p className="text-sm font-semibold text-slate-200">Não foram encontradas transações</p>
              <p className="mt-1 text-xs text-slate-500">Experimenta alterar o filtro ou a pesquisa.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-700/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Data</th>
                    <th className="px-3 py-3 font-semibold">Loja</th>
                    <th className="px-3 py-3 font-semibold">Referência</th>
                    <th className="px-3 py-3 text-right font-semibold">Peso</th>
                    <th className="px-3 py-3 text-right font-semibold">Valor</th>
                    <th className="px-3 py-3 font-semibold">Estado</th>
                    <th className="px-3 py-3 text-right font-semibold">Acção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="transition hover:bg-white/[0.025]">
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-400">{date(tx.created_at)}</td>
                      <td className="px-3 py-4 font-medium text-slate-200">{tx.loja_nome || 'Loja não identificada'}</td>
                      <td className="max-w-[180px] truncate px-3 py-4 font-mono text-[11px] text-slate-500" title={tx.id}>{tx.id.slice(0, 8)}…</td>
                      <td className="px-3 py-4 text-right font-mono text-slate-300">{tx.peso_gramas == null ? '—' : `${Number(tx.peso_gramas).toFixed(2)} g`}</td>
                      <td className="px-3 py-4 text-right font-mono font-semibold text-[#E6C56A]">{money(tx.valor_final)}</td>
                      <td className="px-3 py-4"><div className="flex flex-col items-start gap-1"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(tx.estado)}`}>{statusLabels[tx.estado] || tx.estado}</span>{tx.estado === 'pendente_aprovacao' && tx.primeira_aprovacao_por && (<span className="text-[10px] leading-relaxed text-amber-300">1.ª assinatura registada{tx.data_primeira_aprovacao ? ` · ${date(tx.data_primeira_aprovacao)}` : ''} · aguarda outro administrador</span>)}</div></td>
                      <td className="px-3 py-4 text-right">{tx.estado === 'pendente_aprovacao' ? (
                        <button type="button" onClick={() => void approveTransaction(tx.id)} disabled={Boolean(approvingId)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Aprovar compra ${tx.id}`}>
                          {approvingId === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {tx.primeira_aprovacao_por ? 'Registar 2.ª assinatura' : 'Aprovar compra'}
                        </button>
                      ) : <span className="text-xs text-slate-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-right text-[11px] text-slate-500">{filteredTransactions.length} registos apresentados nesta vista</p>
            </div>
          )}
        </section>
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>Diamante OS · Centro de controlo administrativo</span>
          <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> Consulta protegida</span>
        </div>
      </div>
    </div>
  );
};
