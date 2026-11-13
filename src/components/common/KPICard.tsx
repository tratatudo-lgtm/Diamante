import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus, ArrowUpRight, Activity } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  delta?: { value: number; label: string; isPositiveGood?: boolean };
  highlight?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title, value, subtitle, icon: Icon, delta, highlight = false, isLoading = false, onClick,
}) => {
  if (isLoading) return (
    <div className="relative min-h-[174px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1728]/80 p-5">
      <div className="mb-5 flex items-center justify-between"><div className="h-3 w-28 animate-pulse rounded bg-white/10" /><div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" /></div>
      <div className="mb-3 h-9 w-36 animate-pulse rounded-lg bg-white/10" /><div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
    </div>
  );

  const hasDelta = delta !== undefined && delta.value !== 0 && !Number.isNaN(delta.value);
  const isPositive = delta ? delta.value > 0 : false;
  const isNeutral = delta ? delta.value === 0 : true;
  const deltaColor = isNeutral ? 'text-slate-400' : (isPositive === (delta?.isPositiveGood ?? true) ? 'text-emerald-300' : 'text-rose-300');

  return (
    <button type="button" onClick={onClick} disabled={!onClick} aria-label={onClick ? `${title}: abrir detalhes` : title}
      className={`group relative min-h-[174px] w-full overflow-hidden rounded-2xl border p-5 text-left shadow-[0_12px_35px_-24px_rgba(0,0,0,0.9)] transition-all duration-500 [transform-style:preserve-3d] ${onClick ? 'cursor-pointer hover:-translate-y-2 hover:rotate-[0.4deg] hover:border-[#e7c76b]/50 hover:shadow-[0_24px_65px_-28px_rgba(212,175,55,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c76b]' : 'cursor-default'} ${highlight ? 'border-[#d9b95f]/35 bg-[linear-gradient(145deg,rgba(52,43,24,0.72),rgba(12,22,39,0.96)_52%)]' : 'border-white/[0.08] bg-[linear-gradient(145deg,rgba(20,35,57,0.94),rgba(9,17,31,0.98))]'}`}>
      <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-[#d7b65d]/[0.08] blur-3xl transition-all duration-700 group-hover:bg-[#d7b65d]/20" />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#e4c76f]/50 to-transparent" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.19em] text-slate-400">{title}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${highlight ? 'border-[#d9b95f]/30 bg-[#d9b95f]/10 text-[#f1d47d]' : 'border-white/10 bg-white/[0.04] text-slate-300 group-hover:border-[#d9b95f]/30 group-hover:text-[#f1d47d]'}`}><Icon className="h-[18px] w-[18px]" /></span>
      </div>
      <div className="relative mt-5 flex items-end justify-between gap-2">
        <span className="font-mono text-[clamp(1.55rem,2.2vw,2.1rem)] font-semibold leading-none tracking-[-0.06em] text-white tabular-nums">{value}</span>
        {onClick && <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:border-[#d9b95f]/40 group-hover:text-[#f1d47d]"><ArrowUpRight className="h-4 w-4" /></span>}
      </div>
      <div className="relative mt-4 flex min-h-5 items-center gap-2 border-t border-white/[0.07] pt-3 text-[11px]">
        {hasDelta && <span className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums ${deltaColor}`}>{isPositive ? <TrendingUp className="h-3 w-3" /> : isNeutral ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{isPositive ? '+' : ''}{delta?.value.toFixed(1)}%</span>}
        <span className="truncate text-slate-400">{subtitle || (hasDelta ? delta?.label : 'Consultar módulo')}</span>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-5 right-5 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-[#a98432] via-[#f1d47d] to-transparent transition-transform duration-500 group-hover:scale-x-100" />
      <Activity className="pointer-events-none absolute bottom-4 right-5 h-3 w-3 text-white/[0.04]" />
    </button>
  );
};
