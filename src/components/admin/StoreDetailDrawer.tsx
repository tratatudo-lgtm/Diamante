import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { LojaComKpi, Transacao, Funcionario, KpiLojaDiaria } from '../../types/database';
import { X, Building2, MapPin, Users, Receipt, Calendar, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface StoreDetailDrawerProps {
  loja: LojaComKpi | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const StoreDetailDrawer: React.FC<StoreDetailDrawerProps> = ({
  loja,
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [storeTransactions, setStoreTransactions] = useState<Transacao[]>([]);
  const [storeEmployees, setStoreEmployees] = useState<Funcionario[]>([]);
  const [historyKpis, setHistoryKpis] = useState<KpiLojaDiaria[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isApproving, setIsApproving] = useState<string | null>(null);

  const fetchStoreDetails = useCallback(async (lojaId: string) => {
    setIsLoadingDetails(true);
    try {
      // 1. Transactions of this store
      const { data: txData } = await supabase
        .from('transacoes')
        .select('*')
        .eq('loja_id', lojaId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txData) setStoreTransactions(txData);

      // 2. Employees of this store
      const { data: empData } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('loja_id', lojaId);

      if (empData) setStoreEmployees(empData);

      // 3. KPI history (last 7 days)
      const { data: kpiData } = await supabase
        .from('kpi_loja_diaria')
        .select('*')
        .eq('loja_id', lojaId)
        .order('data', { ascending: false })
        .limit(7);

      if (kpiData) setHistoryKpis(kpiData);
    } catch (err) {
      console.warn('Erro ao carregar detalhes da loja:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && loja?.id) {
      fetchStoreDetails(loja.id);
    }
  }, [isOpen, loja, fetchStoreDetails]);

  if (!isOpen || !loja) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleApproveTransaction = async (txId: string) => {
    setIsApproving(txId);
    try {
      const { error } = await supabase
        .from('transacoes')
        .update({ estado: 'aprovado' })
        .eq('id', txId);

      if (!error) {
        setStoreTransactions((prev) =>
          prev.map((t) => (t.id === txId ? { ...t, estado: 'aprovado' } : t))
        );
        onRefreshData?.();
      }
    } catch (err) {
      console.warn('[Admin] Erro ao aprovar transação:', err);
    } finally {
      setIsApproving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#1F2937] border-l border-gray-800 h-full flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[#D4AF37]">
                  {loja.codigo_loja}
                </span>
                <span className="text-gray-500">·</span>
                <span className="text-xs text-gray-400">
                  {loja.ativo !== false ? 'Loja Ativa' : 'Inativa'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">{loja.nome}</h2>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="truncate">{loja.morada || 'Morada não especificada'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Today's KPI Strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Volume Compras Hoje
              </span>
              <p className="text-xl font-bold font-mono text-[#D4AF37] tabular-nums mt-1">
                {formatCurrency(loja.total_compras_valor || 0)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Pendentes de Aprovação
              </span>
              <p className="text-xl font-bold font-mono text-white tabular-nums mt-1 flex items-center gap-2">
                <span>{loja.pendentes_aprovacao_qtd || 0}</span>
                {loja.pendentes_aprovacao_qtd > 0 && (
                  <span className="text-xs font-sans text-amber-400 font-normal">
                    requer validação
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Section: Transactions of this store */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Transações Recentes da Loja
                </h3>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                {storeTransactions.length} registadas
              </span>
            </div>

            <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800 bg-gray-900/40">
              {isLoadingDetails ? (
                <div className="p-4 text-center text-xs text-gray-500">A carregar registos...</div>
              ) : storeTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  Sem transações registadas nesta loja.
                </div>
              ) : (
                storeTransactions.map((tx) => (
                  <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-gray-800/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-white tabular-nums">
                          {formatCurrency(tx.valor_final)}
                        </span>
                        <span className="text-gray-500">·</span>
                        <span className="font-mono text-gray-400 tabular-nums">
                          {tx.peso_gramas ? `${Number(tx.peso_gramas).toFixed(2)}g` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                        {new Date(tx.created_at).toLocaleString('pt-PT')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          tx.estado === 'pago'
                            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                            : tx.estado === 'aprovado'
                            ? 'text-sky-400 bg-sky-950/60 border border-sky-800/60'
                            : tx.estado === 'pendente_aprovacao'
                            ? 'text-amber-400 bg-amber-950/60 border border-amber-800/60'
                            : 'text-gray-400 bg-gray-800 border border-gray-700'
                        }`}
                      >
                        {tx.estado}
                      </span>

                      {tx.estado === 'pendente_aprovacao' && (
                        <button
                          onClick={() => handleApproveTransaction(tx.id)}
                          disabled={isApproving === tx.id}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Aprovar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Staff Assigned */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Equipa Alocada
                </h3>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                {storeEmployees.length} funcionários
              </span>
            </div>

            <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800 bg-gray-900/40">
              {storeEmployees.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  Nenhum funcionário alocado a esta loja na tabela `funcionarios`.
                </div>
              ) : (
                storeEmployees.map((emp) => (
                  <div key={emp.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">{emp.nome_completo}</p>
                      <p className="text-[11px] text-gray-400">{emp.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                        {emp.role}
                      </span>
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Ativo
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Historical Performance (kpi_loja_diaria) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Histórico Diário (kpi_loja_diaria)
                </h3>
              </div>
            </div>

            <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800 bg-gray-900/40 text-xs">
              {historyKpis.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  Sem histórico arquivado para esta loja.
                </div>
              ) : (
                historyKpis.map((kpi, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between font-mono">
                    <span className="text-gray-400">{kpi.data}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-300">{kpi.total_compras_qtd || 0} compras</span>
                      <span className="font-bold text-[#D4AF37] tabular-nums">
                        {formatCurrency(kpi.total_compras_valor || 0)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/60 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-mono">
            ID: {loja.id.slice(0, 12)}...
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
