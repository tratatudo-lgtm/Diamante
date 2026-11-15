import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  SlidersHorizontal,
  LogOut,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  Phone,
  Store,
  Wallet,
  ReceiptText,
  UserCheck,
  Terminal,
  ChevronRight,
  Command,
  MessageCircle,
  Flag,
  ListTodo,
  Target,
  BriefcaseBusiness,
  MapPinned,
  PackageCheck,
} from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
}

export interface DiamanteSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

/** Rotas preservadas e alinhadas com a navegação administrativa existente. */
export const menuItems: MenuItem[] = [
  { id: 'war-room', label: 'Sala de Guerra', path: '/dashboard-admin', icon: LayoutDashboard, badge: 'LIVE' },
  { id: 'stores', label: 'Gestão de Lojas', path: '/stores', icon: Building2, badge: 'REDE' },
  { id: 'employees', label: 'Equipa & Funcionários', path: '/employees', icon: Users, badge: null },
  { id: 'finance', label: 'Financeiro & Tesouraria', path: '/finance', icon: Wallet, badge: null },
  { id: 'transactions', label: 'Transações', path: '/admin/transacoes', icon: ReceiptText, badge: null },
  { id: 'gold-receiving', label: 'Recepção de Ouro', path: '/admin/recepcao-ouro', icon: PackageCheck, badge: 'SEDE' },
  { id: 'clients', label: 'Clientes & Fornecedores', path: '/clients', icon: UserCheck, badge: null },
  { id: 'settings', label: 'Configurações', path: '/settings', icon: SlidersHorizontal, badge: null },
  { id: 'logs', label: 'Logs & Auditoria', path: '/admin/logs', icon: Terminal, badge: null },
  { id: 'messenger', label: 'Messenger & Ocorrências', path: '/collaboration', icon: MessageCircle, badge: 'NOVO' },
  { id: 'tasks', label: 'Gestão de Tarefas', path: '/tasks', icon: ListTodo, badge: 'OPS' },
  { id: 'goals', label: 'Objectivos & Desempenho', path: '/goals', icon: Target, badge: 'KPI' },
  { id: 'opportunities', label: 'Oportunidades Comerciais', path: '/opportunities', icon: BriefcaseBusiness, badge: 'CRM' },
  { id: 'expansion-sites', label: 'Estudos de Localização', path: '/expansion-sites', icon: MapPinned, badge: 'NEW' },
];

export const navItems = menuItems;

export const DiamanteSidebar: React.FC<DiamanteSidebarProps> = ({ currentPath, onNavigate }) => {
  const { userSession, logout, role } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isAdmin =
    role === 'admin' ||
    userSession?.role === 'admin';

  if (!isAdmin) return null;

  const handleNav = (path: string) => {
    onNavigate(path);
    setIsMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  const adminPhone = String(userSession?.telemovel || '+351 937 230 116');
  const adminName = String(userSession?.nome_completo || 'Administrador Master');

  const isItemActive = (path: string) =>
    currentPath === path ||
    (path === '/stores' && ['/admin/lojas', '/gestao-lojas'].includes(currentPath)) ||
    (path === '/employees' && ['/admin/funcionarios', '/equipa', '/gestao-funcionarios'].includes(currentPath)) ||
    (path === '/finance' && ['/financeiro', '/tesouraria'].includes(currentPath)) ||
    (path === '/admin/transacoes' && ['/admin/transacoes-pendentes'].includes(currentPath)) ||
    (path === '/clients' && ['/clientes', '/fornecedores'].includes(currentPath)) ||
    (path === '/settings' && ['/admin/config', '/configuracoes'].includes(currentPath)) ||
    (path === '/admin/logs' && ['/logs', '/auditoria'].includes(currentPath)) ||
    (path === '/tasks' && currentPath === '/admin/tasks') ||
    (path === '/goals' && currentPath === '/admin/goals') ||
    (path === '/opportunities' && currentPath === '/admin/opportunities') ||
    (path === '/expansion-sites' && currentPath === '/admin/expansion-sites');

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen((open) => !open)}
        className="lg:hidden fixed left-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#0a1221]/95 text-[#f3d982] shadow-[0_8px_32px_rgba(0,0,0,.45)] backdrop-blur-xl transition hover:border-[#D4AF37]/60 hover:bg-[#111d30]"
        aria-label={isMobileOpen ? 'Fechar menu administrativo' : 'Abrir menu administrativo'}
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isMobileOpen && (
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Fechar menu"
          className="lg:hidden fixed inset-0 z-40 bg-[#02050b]/75 backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#080f1c]/95 text-slate-200 shadow-[18px_0_60px_rgba(0,0,0,.28)] backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#D4AF37]/[0.08] blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-cyan-500/[0.06] blur-[80px]" />

        <div className="relative border-b border-white/[0.07] px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#f3d982]/40 bg-gradient-to-br from-[#f4df9a] via-[#c99b2e] to-[#765018] text-[#17120a] shadow-[0_0_28px_rgba(212,175,55,.22)]">
              <div className="absolute inset-[3px] rounded-[13px] border border-white/30" />
              <Sparkles className="relative h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[13px] font-black tracking-[0.17em] text-white">DIAMANTE OS</h1>
                <span className="rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#e9c96e]">V2</span>
              </div>
              <p className="mt-1 truncate text-[10px] font-medium tracking-[0.12em] text-slate-500">INTELLIGENCE PLATFORM</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              </span>
              <span className="text-[10px] font-semibold tracking-[0.13em] text-emerald-200">SISTEMA OPERACIONAL</span>
            </div>
            <ShieldCheck className="h-4 w-4 text-emerald-300/80" />
          </div>
        </div>

        <nav className="relative flex-1 space-y-2 overflow-y-auto px-3.5 py-5">
          <div className="mb-3 flex items-center justify-between px-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            <Command className="h-3.5 w-3.5 text-slate-600" />
          </div>

          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const active = isItemActive(item.path);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.path)}
                aria-current={active ? 'page' : undefined}
                style={{ animationDelay: `${index * 35}ms` }}
                className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left transition-all duration-300 animate-in fade-in slide-in-from-left-2 ${
                  active
                    ? 'border-[#D4AF37]/25 bg-gradient-to-r from-[#D4AF37]/[0.16] via-[#D4AF37]/[0.07] to-transparent text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_8px_24px_rgba(0,0,0,.12)]'
                    : 'border-transparent text-slate-400 hover:border-white/[0.07] hover:bg-white/[0.045] hover:text-white'
                }`}
              >
                {active && <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-r-full bg-gradient-to-b from-[#f6e5a8] to-[#b98724] shadow-[0_0_12px_rgba(212,175,55,.8)]" />}
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 ${
                  active
                    ? 'border-[#D4AF37]/25 bg-[#D4AF37]/[0.13] text-[#f0d27a]'
                    : 'border-white/[0.055] bg-white/[0.025] text-slate-500 group-hover:border-white/10 group-hover:bg-white/[0.07] group-hover:text-slate-200'
                }`}>
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[11px] font-semibold tracking-[0.015em] ${active ? 'text-white' : ''}`}>{item.label}</span>
                  {item.id === 'war-room' && <span className="mt-0.5 block text-[9px] font-medium tracking-wider text-slate-500">CENTRO DE COMANDO</span>}
                </span>
                {item.badge && (
                  <span className={`rounded-md px-1.5 py-1 text-[8px] font-bold tracking-[0.12em] ${
                    active ? 'border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#e7c66c]' : 'border border-white/[0.06] bg-white/[0.035] text-slate-500'
                  }`}>{item.badge}</span>
                )}
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-all duration-300 ${
                  active ? 'translate-x-0 text-[#D4AF37]' : '-translate-x-1 text-slate-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                }`} />
              </button>
            );
          })}

          <div className="!mt-7 border-t border-white/[0.06] pt-5">
            <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Operação de balcão</p>
            <button
              type="button"
              onClick={() => handleNav('/loja-atual')}
              className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-slate-400 transition-all hover:border-white/[0.07] hover:bg-white/[0.045] hover:text-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.025] text-slate-500 transition group-hover:text-[#e7c66c]">
                <Store className="h-[17px] w-[17px]" strokeWidth={1.8} />
              </span>
              <span className="flex-1 text-[11px] font-semibold">Simular Visão de Loja</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
            </button>
          </div>
        </nav>

        <div className="relative border-t border-white/[0.07] bg-[#050a13]/55 p-3.5">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-600">Sessão segura</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.055] to-white/[0.02] p-3 shadow-inner">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[11px] font-black text-[#e7c66c]">
              {adminName.trim().charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white">{adminName}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-500">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{adminPhone}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Terminar sessão"
              aria-label="Terminar sessão"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 transition hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-center text-[8px] font-medium tracking-[0.15em] text-slate-700">DIAMANTE D’OURO · SECURE ACCESS</p>
        </div>
      </aside>
    </>
  );
};

export const AdminSidebar = DiamanteSidebar;
export default DiamanteSidebar;
