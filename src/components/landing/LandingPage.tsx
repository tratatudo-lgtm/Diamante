// PATH: src/components/landing/LandingPage.tsx

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Scale,
  Building2,
  Lock,
  Layers,
  ChevronRight,
  Coins,
  CheckCircle2
} from 'lucide-react';

interface LandingPageProps {
  onAccessSystem: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onAccessSystem }) => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Luz ambiente dourada de prestígio no topo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(212,175,55,0.25),rgba(11,15,25,0))]"
        aria-hidden="true"
      />

      {/* Top Header Institucional */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Logótipo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-yellow-600/40 flex items-center justify-center text-[#D4AF37] shadow-lg shadow-yellow-600/5">
              <Sparkles className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">Diamante OS</span>
                <span className="text-[10px] font-mono font-semibold text-[#D4AF37] border border-yellow-600/40 px-1.5 py-0.5 rounded bg-yellow-950/30">
                  v2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Sala de Operações &amp; Controlo Central
              </p>
            </div>
          </div>

          {/* Estado do Sistema & Ação */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Rede Operacional Ativa</span>
            </div>

            <button
              onClick={onAccessSystem}
              className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#e5be40] hover:to-[#d4af37] text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Aceder ao Sistema</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Principal: Sala de Operações */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        {/* Kicker */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-yellow-600/30 text-xs font-semibold text-yellow-300 mb-6 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
          <span>Infraestrutura Institucional Restrita</span>
        </div>

        {/* Título Oficial Exigido */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl text-balance">
          Gestão Centralizada de Compra de Ouro
        </h1>

        {/* Subtítulo de Solidez e Rigor */}
        <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed text-balance">
          Centro operacional unificado para a rede de lojas e sede da Diamante.
          Auditoria de transações em tempo real, liquidações exclusivas por transferência bancária,
          balancete de stocks em cofre e conformidade estrita com o RGPD.
        </p>

        {/* Botão Principal de Acesso */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={onAccessSystem}
            className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#e5be40] hover:to-[#d4af37] text-slate-950 font-bold text-sm tracking-wide rounded-xl shadow-xl shadow-yellow-600/25 transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 group"
          >
            <span>Aceder ao Sistema</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Pilares Estratégicos de Segurança & Eficiência */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full">
          {/* Pilar 1 */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-yellow-600/40 transition-colors shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] mb-3">
              <Scale className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1.5">Rigor na Avaliação</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cálculo automatizado a partir de cotação spot em tempo real com regras contrastadas para 19.2K, 24K e ligas de ouro.
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-yellow-600/40 transition-colors shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] mb-3">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1.5">Sala de Guerra da Sede</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Monitorização instantânea de compras pendentes de validação, mapa de calor de lojas e feed ao segundo via Supabase.
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 hover:border-yellow-600/40 transition-colors shadow-lg">
            <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1.5">Segurança &amp; Conformidade</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Autenticação 2FA por WhatsApp (Evolution API), sem credenciais públicas, permissões baseadas em RLS e auditoria legal.
            </p>
          </div>
        </div>
      </main>

      {/* Rodapé Corporativo */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Diamante OS v2</span>
            <span>&bull;</span>
            <span>Gestão Centralizada de Compra de Ouro</span>
            <span>&bull;</span>
            <span className="text-slate-400">Sem Vendas</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Transferência Bancária Exclusiva</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Sessão Criptografada
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
