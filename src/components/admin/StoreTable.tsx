import React, { useState } from 'react';
import type { LojaComKpi } from '../../types/database';
import { Building2, Search, ArrowUpRight, AlertCircle, MapPin } from 'lucide-react';

interface StoreTableProps {
  lojas: LojaComKpi[];
  isLoading: boolean;
  onSelectLoja: (loja: LojaComKpi) => void;
}

export const StoreTable: React.FC<StoreTableProps> = ({
  lojas,
  isLoading,
  onSelectLoja,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLojas = lojas.filter((loja) => {
    const q = searchQuery.toLowerCase();
    return (
      loja.nome?.toLowerCase().includes(q) ||
      loja.codigo_loja?.toLowerCase().includes(q) ||
      loja.morada?.toLowerCase().includes(q)
    );
  });

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
      <div className="px-5 py-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Gestão Central de Lojas</h3>
            <p className="text-[11px] text-gray-400">
              Desempenho operacional diário e controlo de pendentes
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar loja ou código..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#111827] border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-900/70 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800 font-mono">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">Loja & Código</th>
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
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                    <Building2 className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-sm font-semibold text-gray-300">
                      {searchQuery ? 'Nenhuma loja encontrada para a pesquisa' : 'Nenhuma loja registada'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {searchQuery ? 'Tente outros termos de pesquisa.' : 'Adicione lojas na base de dados Supabase.'}
                    </p>
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
