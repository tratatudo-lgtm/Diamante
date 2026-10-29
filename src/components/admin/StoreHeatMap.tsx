import React, { useState, useMemo } from 'react';
import type { LojaComKpi } from '../../types/database';
import { MapPin, Building2, ChevronRight, Layers, Info } from 'lucide-react';

interface StoreHeatMapProps {
  lojas: LojaComKpi[];
  isLoading: boolean;
  onSelectLoja: (loja: LojaComKpi) => void;
}

export const StoreHeatMap: React.FC<StoreHeatMapProps> = ({
  lojas,
  isLoading,
  onSelectLoja,
}) => {
  const [hoveredLoja, setHoveredLoja] = useState<LojaComKpi | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');

  // Determine pin color: Verde(0 pendentes), Amarelo(1-3), Vermelho(>3)
  const getPinColor = (pendentes: number) => {
    if (pendentes > 3) {
      return {
        bg: 'bg-rose-500',
        border: 'border-rose-400',
        text: 'text-rose-400',
        ring: 'ring-rose-500/30',
        label: 'Crítico (>3)',
      };
    }
    if (pendentes >= 1) {
      return {
        bg: 'bg-amber-500',
        border: 'border-amber-400',
        text: 'text-amber-400',
        ring: 'ring-amber-500/30',
        label: 'Atenção (1-3)',
      };
    }
    return {
      bg: 'bg-emerald-500',
      border: 'border-emerald-400',
      text: 'text-emerald-400',
      ring: 'ring-emerald-500/30',
      label: 'Nominal (0)',
    };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Compute bounding box for lojas coordinates (or Portugal region defaults if empty/null)
  const mapCoordinates = useMemo(() => {
    const validLojas = lojas.filter(
      (l) => l.latitude != null && l.longitude != null && !isNaN(Number(l.latitude)) && !isNaN(Number(l.longitude))
    );

    if (validLojas.length === 0) {
      // Default Portuguese mainland viewport coords [lat: 37 to 42.2, lon: -9.5 to -6.2]
      return {
        hasCoords: false,
        items: lojas.map((l, index) => ({
          loja: l,
          // Arranged evenly in a clean schematic layout
          x: 20 + ((index * 35) % 70),
          y: 20 + Math.floor(index / 2) * 28,
        })),
      };
    }

    const lats = validLojas.map((l) => Number(l.latitude));
    const lons = validLojas.map((l) => Number(l.longitude));

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latSpan = Math.max(maxLat - minLat, 1.5);
    const lonSpan = Math.max(maxLon - minLon, 1.5);

    return {
      hasCoords: true,
      items: validLojas.map((l) => {
        // Project to SVG percent coordinates
        const x = 12 + (((Number(l.longitude) - minLon) / lonSpan) * 76);
        const y = 88 - (((Number(l.latitude) - minLat) / latSpan) * 76);
        return {
          loja: l,
          x: Math.max(8, Math.min(92, x)),
          y: Math.max(8, Math.min(92, y)),
        };
      }),
    };
  }, [lojas]);

  // Status counts
  const summary = useMemo(() => {
    let verde = 0;
    let amarelo = 0;
    let vermelho = 0;
    lojas.forEach((l) => {
      const p = l.pendentes_aprovacao_qtd || 0;
      if (p > 3) vermelho++;
      else if (p >= 1) amarelo++;
      else verde++;
    });
    return { verde, amarelo, vermelho, total: lojas.length };
  }, [lojas]);

  return (
    <div className="bg-[#1F2937] border border-gray-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[520px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Mapa de Calor da Rede</h3>
            <p className="text-[11px] text-gray-400">Distribuição geográfica e pendentes de aprovação</p>
          </div>
        </div>

        {/* Legend & View Switcher */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>0 Pendentes ({summary.verde})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>1-3 ({summary.amarelo})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>&gt;3 ({summary.vermelho})</span>
            </span>
          </div>

          <div className="flex items-center bg-gray-800 p-0.5 rounded-lg border border-gray-700/60">
            <button
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'map'
                  ? 'bg-gray-700 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Mapa
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-gray-700 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Grelha
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 relative overflow-hidden bg-[#161f2e]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-48 w-48 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
          </div>
        ) : lojas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-500 mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-300">Nenhuma Loja Registada</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              A tabela de lojas está vazia na base de dados Supabase.
            </p>
          </div>
        ) : viewMode === 'map' ? (
          <div className="relative w-full h-full p-4 flex items-center justify-center">
            {/* Dark Tactical Map Grid Backing */}
            <svg
              className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Stylized Portugal / Territorial contour faint background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <Layers className="w-72 h-72 text-[#D4AF37]" strokeWidth={0.5} />
            </div>

            {/* Render Pins on the Map */}
            <div className="relative w-full h-full max-w-2xl max-h-[420px]">
              {mapCoordinates.items.map(({ loja, x, y }) => {
                const pendentes = loja.pendentes_aprovacao_qtd || 0;
                const pinStyle = getPinColor(pendentes);
                const isHovered = hoveredLoja?.id === loja.id;

                return (
                  <div
                    key={loja.id}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                    onMouseEnter={() => setHoveredLoja(loja)}
                    onMouseLeave={() => setHoveredLoja(null)}
                    onClick={() => onSelectLoja(loja)}
                  >
                    {/* Pin button */}
                    <button
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-mono font-bold shadow-lg transition-transform duration-200 cursor-pointer ${
                        pinStyle.bg
                      } ring-4 ${pinStyle.ring} ${
                        isHovered ? 'scale-135 z-30 ring-8 ring-[#D4AF37]/40' : 'hover:scale-115'
                      }`}
                    >
                      {pendentes}
                    </button>

                    {/* Small Store Name Kicker */}
                    <div className="mt-1 px-1.5 py-0.5 rounded bg-gray-900/90 border border-gray-700/80 text-[10px] font-medium text-gray-200 whitespace-nowrap shadow-md pointer-events-none absolute left-1/2 -translate-x-1/2">
                      {loja.nome}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Tooltip Card: Nome Loja, Valor Hoje, Último Clock-in */}
            {hoveredLoja && (
              <div className="absolute bottom-4 left-4 z-40 bg-gray-900/95 border border-[#D4AF37]/50 rounded-xl p-4 shadow-2xl backdrop-blur-md w-72 pointer-events-none animate-in fade-in duration-150">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#D4AF37] tracking-wider uppercase">
                      {hoveredLoja.codigo_loja || 'LOJA'}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {hoveredLoja.nome}
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      getPinColor(hoveredLoja.pendentes_aprovacao_qtd || 0).bg
                    } text-white`}
                  >
                    {hoveredLoja.pendentes_aprovacao_qtd || 0} pendentes
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Valor Comprado Hoje:</span>
                    <span className="font-mono font-semibold text-[#D4AF37] tabular-nums">
                      {formatCurrency(hoveredLoja.total_compras_valor || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Morada:</span>
                    <span className="text-gray-300 truncate max-w-[150px]">
                      {hoveredLoja.morada || 'Não especificada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Último Clock-in:</span>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      Ativo · Hoje
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 text-[10px] text-gray-500 italic flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Clique no pin para abrir detalhes completos
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Grid View Mode */
          <div className="h-full overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lojas.map((loja) => {
              const pendentes = loja.pendentes_aprovacao_qtd || 0;
              const pinStyle = getPinColor(pendentes);

              return (
                <div
                  key={loja.id}
                  onClick={() => onSelectLoja(loja)}
                  className="bg-gray-900/60 border border-gray-800 hover:border-[#D4AF37]/50 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-150 cursor-pointer hover:bg-gray-800/60 group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-gray-400">
                        {loja.codigo_loja}
                      </span>
                      <h4 className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                        {loja.nome}
                      </h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pinStyle.bg} text-white`}
                    >
                      {pendentes}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] text-gray-400">Volume Hoje</p>
                      <p className="font-mono font-bold text-[#D4AF37] tabular-nums">
                        {formatCurrency(loja.total_compras_valor || 0)}
                      </p>
                    </div>
                    <button className="text-gray-400 group-hover:text-white flex items-center text-xs">
                      Ver <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
