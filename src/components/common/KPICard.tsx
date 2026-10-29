import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  delta?: {
    value: number;
    label: string;
    isPositiveGood?: boolean;
  };
  highlight?: boolean;
  isLoading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  delta,
  highlight = false,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-[#1F2937] border border-gray-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-24 bg-gray-700/60 rounded animate-pulse" />
          <div className="h-8 w-8 bg-gray-700/40 rounded-lg animate-pulse" />
        </div>
        <div className="h-8 w-36 bg-gray-700/80 rounded animate-pulse mb-2" />
        <div className="h-3 w-28 bg-gray-700/40 rounded animate-pulse" />
      </div>
    );
  }

  // Calculate percentage delta
  const hasDelta = delta !== undefined && delta.value !== 0 && !isNaN(delta.value);
  const isPositive = delta ? delta.value > 0 : false;
  const isNeutral = delta ? delta.value === 0 : true;

  const deltaColor = () => {
    if (isNeutral) return 'text-gray-400';
    const isGood = delta?.isPositiveGood ?? true;
    if (isPositive) return isGood ? 'text-emerald-400' : 'text-amber-400';
    return isGood ? 'text-rose-400' : 'text-emerald-400';
  };

  return (
    <div
      className={`bg-[#1F2937] border transition-all duration-150 rounded-xl p-5 shadow-sm relative overflow-hidden ${
        highlight
          ? 'border-[#D4AF37]/50 shadow-md shadow-[#D4AF37]/5'
          : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      {/* Top subtle gold highlight if highlighted */}
      {highlight && (
        <div className="absolute top-0 inset-x-0 h-[2px] bg-[#D4AF37]" />
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider uppercase text-gray-400">
          {title}
        </span>
        <div
          className={`p-2 rounded-lg border ${
            highlight
              ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37]'
              : 'bg-gray-800/80 border-gray-700/60 text-gray-300'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
          {value}
        </span>
      </div>

      {/* Comparison vs Yesterday / Subtitle */}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-400">
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 font-medium font-mono tabular-nums ${deltaColor()}`}>
            {isPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : isNeutral ? (
              <Minus className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {delta?.value.toFixed(1)}%
            </span>
          </span>
        )}
        {subtitle && (
          <span className="text-gray-400 truncate">
            {hasDelta ? `· ${subtitle}` : subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
