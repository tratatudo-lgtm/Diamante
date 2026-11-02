import React, { useState, useMemo } from 'react';
import type { LojaComKpi } from '../../types/database';
import {
  Building2,
  Search,
  ArrowUpRight,
  MapPin,
  Filter,
  X,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Hash,
} from 'lucide-react';

interface StoreTableProps {
  lojas: LojaComKpi[];
  isLoading: boolean;
  onSelectLoja: (loja: LojaComKpi) => void;
}

export type StatusFilterOption = 'todos' | 'ativo' | 'inativo';

export const StoreTable: React.FC<StoreTableProps> = ({
  lojas,
  isLoading,
  onSelectLoja,
}) => {
  const [nomeQuery, setNomeQuery] = useState('');
  const [codigoQuery, setCodigoQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('todos');

  // Filtered stores computation
  const filteredLojas = useMemo(() => {
    return lojas.filter((loja) => {
      // Filter by Store Name
      if (nomeQuery.trim()) {
        const query = nomeQuery.trim().toLowerCase();
        const nomeMatch = loja.nome?.toLowerCase().includes(query);
        if (!nomeMatch) return false;
      }

      // Filter by Store Code
      if (codigoQuery.trim()) {
        const query = codigoQuery.trim().toLowerCase();
        const codigoMatch = loja.codigo_loja?.toLowerCase().includes(query);
        if (!codigoMatch) return false;
      }

      // Filter by Status (ativo / inativo)
      const isAtivo = loja.ativo !== false;
      if (statusFilter === 'ativo' && !isAtivo) return false;
      if (statusFilter === 'inativo' && isAtivo) return false;

      return true;
    });
  }, [lojas, nomeQuery, codigoQuery, statusFilter]);

  const hasActiveFilters =
    nomeQuery.trim() !== '' ||
    codigoQuery.trim() !== '' ||
    statusFilter !== 'todos';

  const clearAllFilters = () => {
    setNomeQuery('');
    setCodigoQuery('');
    setStatusFilter('todos');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="bg-[#1F2937] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Header Bar */}
      <div className="px-5 py-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Gestão Central de Lojas</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-800 text-gray-300 border border-gray-700">
                {filteredLojas.length} {filteredLojas.length === 1 ? 'loja' : 'lojas'}
                {hasActiveFilters && ` de ${lojas.length}`}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Desempenho operacional diário, estado de rede e controlo de pendentes
            </p>
          </div>
        </div>

        {/* Action if filters are active */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/50 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      {/* REQUISITO: Filtros e Pesquisa (Nome, Código e Status) */}
      <div className="p-4 bg-gray-900/20 border-b border-gray-800/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Input 1: Pesquisa por Nome da Loja */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
              <Search className="w-3 h-3 text-[#D4AF37]" />
              <span>Nome da Loja</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={nomeQuery}
                onChange={(e) => setNomeQuery(e.target.value)}
                placeholder="Pesquisar por nome (ex: Chiado, Baixa)..."
                className="w-full pl-3 pr-8 py-2 bg-[#111827] border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
              {nomeQuery && (
                <button
                  type="button"
                  onClick={() => setNomeQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-200"
                  title="Limpar pesquisa por nome"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Input 2: Pesquisa por Código da Loja */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#D4AF37]" />
              <span>Código da Loja</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={codigoQuery}
                onChange={(e) => setCodigoQuery(e.target.value)}
                placeholder="Código (ex: LIS01, POR02)..."
                className="w-full pl-3 pr-8 py-2 bg-[#111827] border border-gray-700 rounded-lg text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors uppercase"
              />
              {codigoQuery && (
                <button
                  type="button"
                  onClick={() => setCodigoQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-200"
                  title="Limpar código"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown 3: Filtro por Status (Ativo / Inativo) */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#D4AF37]" />
              <span>Status</span>
            </label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                className="w-full px-3 py-2 bg-[#111827] border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-colors appearance-none cursor-pointer pr-8"
              >
                <option value="todos" className="bg-[#111827] text-white">
                  Todos os status
                </option>
                <option value="ativo" className="bg-[#111827] text-emerald-400">
                  ● Ativo
                </option>
                <option value="inativo" className="bg-[#111827] text-rose-400">
                  ○ Inativo
                </option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Active filters indicators bar */}
        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-gray-800/60 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] text-gray-400">Filtros ativos:</span>
            {nomeQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-200 text-[11px]">
                <span className="text-gray-400">Nome:</span> &ldquo;{nomeQuery.trim()}&rdquo;
                <button
                  onClick={() => setNomeQuery('')}
                  className="hover:text-amber-400 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {codigoQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-200 text-[11px] font-mono">
                <span className="text-gray-400">Código:</span> {codigoQuery.trim().toUpperCase()}
                <button
                  onClick={() => setCodigoQuery('')}
                  className="hover:text-amber-400 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'todos' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-200 text-[11px]">
                <span className="text-gray-400">Status:</span>{' '}
                <span className={statusFilter === 'ativo' ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {statusFilter === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  onClick={() => setStatusFilter('todos')}
                  className="hover:text-amber-400 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-[11px] text-gray-400 hover:text-white underline underline-offset-2 ml-auto cursor-pointer"
            >
              Repor todos
            </button>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-900/70 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800 font-mono">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">Loja & Código</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Morada</th>
              <th scope="col" className="px-4 py-3 font-semibold">Coordenadas</th>
              <th scope="col" className="px-4 py-3 font-semibold text-center">Pendentes</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Volume Hoje (€)</th>
              <th scope="col" className="px-5 py-3 font-semibold text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {isLoading ? (
              // Skeletons
              [1, 2, 3, 4].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-3.5"><div className="h-4 bg-gray-800 rounded w-32" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 bg-gray-800 rounded w-16" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 bg-gray-800 rounded w-48" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 bg-gray-800 rounded w-20" /></td>
                  <td className="px-4 py-3.5 text-center"><div className="h-4 bg-gray-800 rounded w-12 mx-auto" /></td>
                  <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-800 rounded w-20 ml-auto" /></td>
                  <td className="px-5 py-3.5 text-right"><div className="h-6 bg-gray-800 rounded w-24 ml-auto" /></td>
                </tr>
              ))
            ) : filteredLojas.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <Building2 className="w-10 h-10 text-gray-600 mb-2.5" />
                    <p className="text-sm font-semibold text-gray-200">
                      {hasActiveFilters
                        ? 'Nenhuma loja encontrada com os filtros aplicados'
                        : 'Nenhuma loja registada'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {hasActiveFilters
                        ? 'Tente ajustar ou limpar o nome, código ou status selecionados.'
                        : 'Adicione lojas na base de dados Supabase.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Limpar todos os filtros</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredLojas.map((loja) => {
                const pendentes = loja.pendentes_aprovacao_qtd || 0;
                const pendenteColor =
                  pendentes > 3
                    ? 'text-rose-400 bg-rose-950/60 border-rose-800/50'
                    : pendentes >= 1
                    ? 'text-amber-400 bg-amber-950/60 border-amber-800/50'
                    : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50';

                const isAtivo = loja.ativo !== false;

                return (
                  <tr
                    key={loja.id}
                    className="hover:bg-gray-800/40 transition-colors group"
                  >
                    {/* Nome + Código */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
                          {loja.nome}
                        </span>
                        <span className="font-mono text-[10px] text-gray-400 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700/60">
                          {loja.codigo_loja}
                        </span>
                      </div>
                    </td>

                    {/* Status (Ativo / Inativo) */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isAtivo ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/40 text-rose-400 border border-rose-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>Inativo</span>
                        </span>
                      )}
                    </td>

                    {/* Morada */}
                    <td className="px-4 py-3.5 text-gray-400 max-w-xs truncate">
                      {loja.morada || '—'}
                    </td>

                    {/* Coordenadas */}
                    <td className="px-4 py-3.5 font-mono text-gray-400 tabular-nums">
                      {loja.latitude && loja.longitude ? (
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <MapPin className="w-3 h-3 text-[#D4AF37]" />
                          {Number(loja.latitude).toFixed(2)}, {Number(loja.longitude).toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Pendentes */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-xs font-mono font-bold border ${pendenteColor}`}
                      >
                        {pendentes}
                      </span>
                    </td>

                    {/* Volume Hoje */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-sm text-[#D4AF37] tabular-nums">
                      {formatCurrency(loja.total_compras_valor || 0)}
                    </td>

                    {/* Botão Ver Detalhes */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onSelectLoja(loja)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-[#D4AF37] text-gray-300 hover:text-gray-950 font-medium text-xs rounded-lg border border-gray-700 hover:border-[#D4AF37] transition-all cursor-pointer active:scale-95"
                      >
                        <span>Ver Detalhes</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
