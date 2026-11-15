import React, { useState, useEffect, useCallback } from 'react';
import type { InventarioFisico } from '../../types/database';
import {
  Boxes,
  Package,
  Send,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  Flame,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface InventoryListProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
}

export const InventoryList: React.FC<InventoryListProps> = ({ onShowToast }) => {
  const [items, setItems] = useState<InventarioFisico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'em_loja' | 'enviado_sede' | 'fundido'>('em_loja');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Consultar inventário exclusivamente através da API autenticada.
  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
      const response = await fetch('/api/store/inventory', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.items)) {
        throw new Error(payload?.message || 'Não foi possível obter o inventário.');
      }
      setItems(payload.items as InventarioFisico[]);
    } catch (err) {
      console.warn('[Inventário] Falha ao carregar inventário físico.');
      onShowToast('error', err instanceof Error ? err.message : 'Não foi possível obter os dados do inventário.');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  // Ação: Marcar como enviado para a sede
  const handleMarkAsSent = async (itemId: string, codigoUnico: string) => {
    setUpdatingId(itemId);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão de API não encontrada.');
      const response = await fetch(`/api/store/inventory/${encodeURIComponent(itemId)}/dispatch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Não foi possível registar a expedição.');
      }

      await fetchInventory();
      onShowToast('success', `Lote ${codigoUnico} marcado como enviado para a Sede.`, 'Inventário Atualizado');
    } catch (err: unknown) {
      console.warn('[Inventário] Falha ao atualizar estado.');
      onShowToast('error', 'Erro ao atualizar estado no inventário.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtragem
  const filteredItems = items.filter((item) => {
    const matchesFilter =
      statusFilter === 'todos' ? true : item.estado === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.codigo_unico?.toLowerCase().includes(q) ||
      item.metal?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // Estatísticas rápidas
  const totalPesoEmLoja = items
    .filter((i) => i.estado === 'em_loja')
    .reduce((sum, i) => sum + (Number(i.peso_gramas) || 0), 0);

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'em_loja':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Em Loja (Cofre)
          </span>
        );
      case 'enviado_sede':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-950/70 border border-sky-700/60 px-2 py-0.5 rounded">
            <Send className="w-3 h-3" />
            Enviado à Sede
          </span>
        );
      case 'fundido':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 bg-purple-950/70 border border-purple-700/60 px-2 py-0.5 rounded">
            <Flame className="w-3 h-3" />
            Fundido / Barra
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded">
            {estado}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header com Totais */}
      <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Inventário Físico da Loja</h2>
              <p className="text-xs text-gray-400">
                Registo rastreado de peças de ouro e metais no cofre
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-gray-900/60 px-3.5 py-2 rounded-xl border border-gray-800">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block">
                Total em Cofre
              </span>
              <span className="font-mono font-bold text-sm text-[#D4AF37] tabular-nums">
                {totalPesoEmLoja.toFixed(1)} g
              </span>
            </div>
            <div className="h-6 w-px bg-gray-800" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block">
                Peças Físicas
              </span>
              <span className="font-mono font-bold text-sm text-white tabular-nums">
                {items.filter((i) => i.estado === 'em_loja').length}
              </span>
            </div>
          </div>
        </div>

        {/* Filtros e Pesquisa */}
        <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStatusFilter('em_loja')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'em_loja'
                  ? 'bg-[#D4AF37] text-gray-950 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Em Loja ({items.filter((i) => i.estado === 'em_loja').length})
            </button>
            <button
              onClick={() => setStatusFilter('enviado_sede')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'enviado_sede'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Enviados ({items.filter((i) => i.estado === 'enviado_sede').length})
            </button>
            <button
              onClick={() => setStatusFilter('fundido')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'fundido'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Fundidos
            </button>
            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'todos'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos ({items.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Código único ou metal..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#111827] border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {isLoading ? (
          // Skeletons
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-800/40 rounded-xl animate-pulse" />
          ))
        ) : filteredItems.length === 0 ? (
          // Empty State
          <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-300">
              {searchQuery ? 'Nenhuma peça encontrada na pesquisa' : 'Inventário Vazio'}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Tente pesquisar por outro código ou tipo de metal.'
                : 'Quando registar uma nova compra de ouro, o item físico correspondente será automaticamente guardado aqui.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#1F2937] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
            >
              {/* Código Único | Metal | Peso */}
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-[#D4AF37] shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-white">
                      {item.codigo_unico}
                    </span>
                    <span className="text-gray-600">·</span>
                    <span className="text-xs text-gray-300 font-medium">
                      {item.metal}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span className="font-mono font-semibold text-[#D4AF37] tabular-nums">
                      {Number(item.peso_gramas).toFixed(2)} g
                    </span>
                    {item.data_entrada && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {format(new Date(item.data_entrada), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Estado e Ação "Marcar como Enviado" */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                {getStatusBadge(item.estado)}

                {item.estado === 'em_loja' && (
                  <button
                    onClick={() => handleMarkAsSent(item.id, item.codigo_unico)}
                    disabled={updatingId === item.id}
                    className="min-h-[38px] px-3 py-1.5 bg-gray-800 hover:bg-sky-950 text-gray-300 hover:text-sky-300 rounded-lg text-xs font-medium border border-gray-700 hover:border-sky-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {updatingId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Marcar Enviado</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
