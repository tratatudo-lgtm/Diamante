import React, { useState } from 'react';
import { 
  LayoutDashboard, Store, Users, UserCheck, Wallet, Settings, 
  Menu, X, LogOut, ChevronRight 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const menuItems = [
  { id: 'warroom', label: 'Sala de Guerra', icon: LayoutDashboard, path: '/admin/warroom' },
  { id: 'stores', label: 'Gestão de Lojas', icon: Store, path: '/admin/stores' },
  { id: 'employees', label: 'Equipa & Funcionários', icon: Users, path: '/admin/employees' },
  { id: 'clients', label: 'Clientes & Fornecedores', icon: UserCheck, path: '/admin/clients' },
  { id: 'finance', label: 'Financeiro & Tesouraria', icon: Wallet, path: '/admin/finance' },
  { id: 'settings', label: 'Configurações', icon: Settings, path: '/admin/settings' },
];

export const DiamanteSidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPath, onNavigate }) => {
  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 h-full w-[280px] bg-[#0b0f19] border-r border-[#D4AF37]/20 
        transform transition-transform duration-300 ease-in-out z-50 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header / Logo Area */}
        <div className="p-6 border-b border-[#D4AF37]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#D4AF37] to-[#F5E098] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              <span className="text-black font-bold text-lg">D</span>
            </div>
            <div>
              <h1 className="font-bold text-[#D4AF37] tracking-wide text-sm">DIAMANTE OS</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">v2.0 Enterprise</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          <p className="px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">Menu Principal</p>
          
          {menuItems.map((item) => {
            const isActive = currentPath === item.path || (item.id === 'warroom' && currentPath.includes('warroom'));
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.path);
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden
                  ${isActive 
                    ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 shadow-[0_0_20px_rgba(212,175,55,0.05)]' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}
                `}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4AF37] rounded-r-full" />
                )}
                
                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-[#D4AF37]' : 'group-hover:text-[#D4AF37]'}`} />
                <span className="font-medium text-sm">{item.label}</span>
                
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
              </button>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="p-4 border-t border-[#D4AF37]/20 bg-[#080c14]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5 border border-white/5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#8B6914] flex items-center justify-center text-black font-bold text-xs">
              JT
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">João Teste</p>
              <p className="text-[10px] text-[#D4AF37] truncate">Administrador Master</p>
            </div>
            <button className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
