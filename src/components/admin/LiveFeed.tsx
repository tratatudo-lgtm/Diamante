import React, { useEffect, useRef, useState } from 'react';
import type { Transacao, Loja } from '../../types/database';
import { Radio, Clock, ArrowDownLeft, Inbox, RefreshCw, AlertTriangle } from 'lucide-react';

interface LiveFeedProps {
  lojasMap: Record<string, Loja>;
  transacoes: Transacao[];
  isLoading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onSelectTransaction?: (tx: Transacao) => void;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({
  lojasMap,
  transacoes,
  isLoading,
  errorMessage,
  onRefresh,
  onSelectTransaction,
}) => {
  const [newTxId, setNewTxId] = useState<string | null>(null);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const lastEventTime = transacoes.length > 0
    ? new Date(transacoes[0].created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Deteta novas transações recebidas pela API e preserva o destaque visual.
  useEffect(() => {
    const currentIds = new Set(transacoes.map((tx) => tx.id));
    const newTransaction = transacoes.find((tx) => !previousIdsRef.current.has(tx.id));

    if (previousIdsRef.current.size > 0 && newTransaction) {
      setNewTxId(newTransaction.id);
      const scrollTimer = window.setTimeout(() => {
        topAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      const highlightTimer = window.setTimeout(() => setNewTxId(null), 3000);

      previousIdsRef.current = currentIds;
      return () => {
        window.clearTimeout(scrollTimer);
        window.clearTimeout(highlightTimer);
      };
    }

    previousIdsRef.current = currentIds;
  }, [transacoes]);

  // Status badge styling helper
  const renderStatus = (estado: Transacao['estado']) => {
    switch (estado) {
      case 'pago':
        return (
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
            Pago (Transf.)
          </span>
        );
      case 'aprovado':
        return (
          <span className="text-[11px] font-medium text-sky-400 bg-sky-950/60 border border-sky-700/50 px-2 py-0.5 rounded">
            Aprovado
          </span>
        );
      case 'pendente_aprovacao':
        return (
          <span className="text-[11px] font-medium text-amber-400 bg-amber-950/60 border border-amber-700/50 px-2 py-0.5 rounded">
            Pendente
          </span>
        );
      case 'rascunho':
      default:
        return (
          <span className="text-[11px] font-medium text-gray-400 bg-gray-800/80 border border-gray-700/50 px-2 py-0.5 rounded">
            Rascunho
          </span>
        );
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="bg-[#1F2937] border border-gray-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[520px]">
      {/* Feed Header */}
      <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Feed Realtime</h3>
            <p className="text-[11px] text-gray-400">Transações de compra em tempo real (Limite 20)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastEventTime && (
            <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-500" />
              {lastEventTime}
            </span>
          )}
          <button
            onClick={onRefresh}
            title="Atualizar Feed"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto divide-y divide-gray-800/60 p-2">
        <div ref={topAnchorRef} />

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-gray-800/40 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Error Notice */}
        {!isLoading && errorMessage && (
          <div className="p-4 m-2 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Empty State - STRICTLY NO MOCK DATA */}
        {!isLoading && !errorMessage && transacoes.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="w-12 h-12 rounded-xl bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-gray-500 mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-300">Sem Transações Registadas</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              A tabela de transações está vazia. Assim que uma loja registar uma nova compra de ouro, ela surgirá aqui em tempo real.
            </p>
          </div>
        )}

        {/* Real Transactions List: [HH:mm] [Loja] [Ação] [€Valor] [Badge Status] */}
        {!isLoading &&
          transacoes.map((tx) => {
            const loja = lojasMap[tx.loja_id];
            const lojaNome = loja ? loja.nome : `Loja #${tx.loja_id.slice(0, 6)}`;
            const isNew = tx.id === newTxId;

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction?.(tx)}
                className={`p-3 rounded-lg flex items-center justify-between gap-3 text-xs transition-all duration-300 cursor-pointer ${
                  isNew
                    ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-white'
                    : 'hover:bg-gray-800/60 text-gray-300'
                }`}
              >
                {/* [HH:mm] + [Ação icon] */}
                <div className="flex items-center gap-2.5 min-w-[70px]">
                  <span className="font-mono text-gray-400 tabular-nums">
                    {formatTime(tx.created_at)}
                  </span>
                  <div className="p-1 rounded bg-amber-500/10 text-[#D4AF37]">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* [Loja] + [Ação info] */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                      {lojaNome}
                    </span>
                    {loja?.codigo_loja && (
                      <span className="text-[10px] font-mono text-gray-500">
                        ({loja.codigo_loja})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                    <span>Compra de Ouro</span>
                    <span className="text-gray-600">·</span>
                    <span className="font-mono tabular-nums text-gray-300">
                      {tx.peso_gramas ? `${Number(tx.peso_gramas).toFixed(2)}g` : '--'}
                    </span>
                  </div>
                </div>

                {/* [€Valor] */}
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-[#D4AF37] tabular-nums">
                    {formatCurrency(tx.valor_final)}
                  </span>
                </div>

                {/* [Badge Status] */}
                <div className="shrink-0 min-w-[80px] text-right">
                  {renderStatus(tx.estado)}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
