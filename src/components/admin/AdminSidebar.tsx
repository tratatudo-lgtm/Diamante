// PATH: src/components/admin/AdminSidebar.tsx
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
} from 'lucide-react';

interface AdminSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPath, onNavigate }) => {
  const { userSession, logout, role } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Verificação estrita de segurança: visível APENAS para admins
  const isAdmin = role === 'admin' || role === 'master' || userSession?.role === 'admin' || userSession?.role === 'master';
  if (!isAdmin) {
    return null;
  }

  const navItems = [
    {
      id: 'war-room',
      label: 'Sala de Guerra',
      path: '/dashboard-admin',
      icon: LayoutDashboard,
      badge: 'Tempo Real',
    },
    {
      id: 'lojas',
      label: 'Lojas & Balcões',
      path: '/admin/lojas',
      icon: Building2,
      badge: '24 Ativas',
    },
    {
      id: 'funcionarios',
      label: 'Funcionárias',
      path: '/admin/funcionarios',
      icon: Users,
      badge: null,
    },
    {
      id: 'config',
      label: 'Configurações',
      path: '/admin/config',
      icon: SlidersHorizontal,
      badge: null,
    },
  ];

  const handleNav = (path: string) => {
    onNavigate(path);
    setIsMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  const adminPhone = userSession?.telemovel || '+351 937 230 116';
  const adminName = userSession?.nome_completo || 'Administrador Master';

  return (
    <>
      {/* Botão Mobile Hamburger */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 text-slate-200 shadow-xl backdrop-blur-md hover:text-[#D4AF37] transition-all cursor-pointer"
          aria-label="Abrir Menu Administrativo"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Overlay escuro no mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-xs animate-in fade-in"
        />
      )}

      {/* Barra Lateral Desktop e Drawer Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Topo: Marca e Identidade */}
        <div>
          <div className="p-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-sm tracking-wider text-white uppercase font-sans">
                    Diamante OS
                  </h1>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                    v2
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Gestão de Compra de Ouro
                </p>
              </div>
            </div>

            {/* Badge de Acesso Master */}
            <div className="mt-4 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span className="text-[11px] font-medium text-amber-200 truncate">
                Modo Master Ativo
              </span>
            </div>
          </div>

          {/* Navegação Principal */}
          <nav className="p-3 space-y-1">
            <p className="px-3 pt-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 font-mono">
              Painel de Gestão
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#D4AF37]/20 to-amber-500/10 text-white border border-[#D4AF37]/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-[#D4AF37]' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                        isActive
                          ? 'bg-[#D4AF37]/30 text-amber-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Acesso rápido à Visão de Balcão (para auditoria) */}
            <div className="pt-4">
              <p className="px-3 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 font-mono">
                Auditoria de Balcão
              </p>
              <button
                onClick={() => handleNav('/loja-atual')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <Store className="w-4 h-4 text-slate-400" />
                <span>Simular Visão de Loja</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Rodapé: Perfil Master & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">
                {adminName}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#D4AF37]">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{adminPhone}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Terminar Sessão"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
              aria-label="Terminar Sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
