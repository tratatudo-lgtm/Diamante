// PATH: src/components/landing/LandingPage.tsx

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Scale,
  Building2,
  Lock,
  CheckCircle2,
  Store,
  LayoutDashboard,
  ChevronRight,
} from 'lucide-react';

interface LandingPageProps {
  onAccessSystem?: () => void;
}

const STORE_PORTAL_URL = 'https://loja-diamantedouro.duckdns.org/login';
const ADMIN_PORTAL_URL = 'https://admin-diamantedouro.duckdns.org/login';

export const LandingPage: React.FC<LandingPageProps> = () => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col relative overflow-hidden font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      <div
        className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(212,175,55,0.25),rgba(11,15,25,0))]"
        aria-hidden="true"
      />

      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <a href="https://diamantedouro.duckdns.org/" className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-yellow-600/40 flex items-center justify-center text-[#D4AF37] shadow-lg shadow-yellow-600/5 shrink-0">
              <Sparkles className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <span className="block text-lg font-bold tracking-tight text-white">DIAMANTE D'OURO</span>
              <span className="block text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide">
                Compra e gestão de ouro
              </span>
            </div>
          </a>

          <nav aria-label="Acessos à plataforma" className="flex items-center gap-2 sm:gap-3">
            <a
              href={STORE_PORTAL_URL}
              className="hidden sm:inline-flex min-h-[42px] items-center gap-2 px-4 rounded-xl border border-slate-700 text-slate-200 hover:border-yellow-600/50 hover:text-white transition-colors text-xs font-semibold"
            >
              <Store className="w-4 h-4 text-[#D4AF37]" />
              Área de Loja
            </a>
            <a
              href={ADMIN_PORTAL_URL}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#e5be40] hover:to-[#d4af37] text-slate-950 transition-colors text-xs font-bold"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Administração</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-yellow-600/30 text-xs font-semibold text-yellow-300 mb-7 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>Plataforma operacional Diamante D'Ouro</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto text-balance leading-[1.08]">
            Gestão de compra de ouro com rigor, transparência e controlo.
          </h1>

          <p className="mt-6 text-sm sm:text-base text-slate-300 max-w-3xl mx-auto leading-relaxed text-balance">
            Uma plataforma centralizada para apoiar as operações da Diamante D'Ouro,
            ligar as equipas das lojas à administração e acompanhar cada etapa do processo
            com segurança e rastreabilidade.
          </p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto text-left">
            <a
              href={STORE_PORTAL_URL}
              className="group min-h-[150px] p-6 rounded-2xl bg-slate-900/80 border border-slate-700 hover:border-yellow-600/60 hover:bg-slate-900 transition-all shadow-xl shadow-black/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#D4AF37]">
                  <Store className="w-5 h-5" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-[#D4AF37] group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-white">Área de Loja</h2>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                Acesso dos colaboradores às operações, clientes e registo de compras.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#D4AF37]">
                Entrar na área de loja <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </a>

            <a
              href={ADMIN_PORTAL_URL}
              className="group min-h-[150px] p-6 rounded-2xl bg-slate-900/80 border border-yellow-600/30 hover:border-yellow-500/70 hover:bg-slate-900 transition-all shadow-xl shadow-black/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-11 h-11 rounded-xl bg-yellow-950/40 border border-yellow-700/30 flex items-center justify-center text-[#D4AF37]">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-[#D4AF37] group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-white">Área Administrativa</h2>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                Acesso reservado à gestão central, validações, controlo e acompanhamento.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#D4AF37]">
                Entrar na administração <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </a>
          </div>
        </section>

        <section className="border-y border-slate-800/80 bg-slate-950/35">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
            <div className="max-w-2xl mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Operação integrada</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">Uma plataforma. Processos ligados.</h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Cada área tem um endereço próprio, mantendo os acessos separados e encaminhando
                as operações para os serviços centrais da plataforma.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] mb-4">
                  <Scale className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Rigor na avaliação</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Processos de avaliação e registo de operações com regras definidas e informação rastreável.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] mb-4">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Coordenação central</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ligação entre lojas e administração, com acompanhamento das operações e validações.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] mb-4">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Segurança e conformidade</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Acessos autenticados, permissões por função e registo das operações relevantes.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Diamante D'Ouro</span>
            <span>•</span>
            <span>Plataforma de gestão de compra de ouro</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Acessos protegidos</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
