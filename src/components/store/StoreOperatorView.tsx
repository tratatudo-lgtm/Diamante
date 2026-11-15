import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { StoreDashboard } from './StoreDashboard';
import { NewPurchaseForm } from './NewPurchaseForm';
import { InventoryList } from './InventoryList';
import { ProtectedClients } from './ProtectedClients';
import { ProfileView } from './ProfileView';
import { ToastContainer, type ToastMessage } from '../common/Toast';
import {
  LayoutDashboard,
  PlusCircle,
  Boxes,
  Users,
  User,
  Sparkles,
  ArrowLeft,
  MapPin
} from 'lucide-react';

interface StoreOperatorViewProps {
  onNavigate: (path: string) => void;
}

export const StoreOperatorView: React.FC<StoreOperatorViewProps> = ({ onNavigate }) => {
  const { userSession, funcionario, logout } = useAuth();
  
  // 5 Tabs:
  // 0: Painel de Controlo
  // 1: Nova Compra
  // 2: Inventário
  // 3: Clientes Protegidos
  // 4: Perfil & Configurações
  const [activeTab, setActiveTab] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string, title?: string) => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      title,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  const role = userSession?.role || funcionario?.role;
  const lojaNome = userSession?.loja_nome || 'Sala de Operações';
  const codigoLoja = userSession?.codigo_loja || 'LOJA';

  const navItems = [
    { label: 'Painel', icon: LayoutDashboard },
    { label: 'Nova Compra', icon: PlusCircle, isPrimary: true },
    { label: 'Inventário', icon: Boxes },
    { label: 'Clientes', icon: Users },
    { label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#111827] text-gray-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Top Bar Operacional */}
      <header className="sticky top-0 z-30 bg-[#1F2937]/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-900 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight">Diamante OS</span>
                <span className="text-[10px] font-mono text-[#D4AF37] border border-[#D4AF37]/40 px-1 rounded">
                  v2
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">
                Sala de Operações de Loja
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <button
                onClick={() => onNavigate('/dashboard-admin')}
                className="px-3 py-1.5 bg-gray-800 hover:bg-[#D4AF37] text-gray-300 hover:text-gray-950 font-medium text-xs rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sala de Guerra</span>
              </button>
            )}

            <button onClick={() => onNavigate('/collaboration')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/30 bg-gray-900 px-3 py-2 text-xs font-semibold text-[#E6C66B] hover:bg-[#D4AF37]/10">
              <Users className="h-4 w-4" /><span className="hidden sm:inline">Messenger</span>
            </button>
            <button onClick={() => onNavigate('/reportar-situacao')} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-gray-900 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10">
              <Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Reportar problema</span>
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300">
              <MapPin className="w-3 h-3 text-[#D4AF37]" />
              <span className="font-mono text-[11px] text-[#D4AF37] font-semibold">{codigoLoja}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-5 pb-28">
        {activeTab === 0 && (
          <StoreDashboard
            onNavigateTab={(tab) => setActiveTab(tab)}
            onShowToast={addToast}
          />
        )}

        {activeTab === 1 && (
          <NewPurchaseForm
            onSuccess={() => {
              setActiveTab(0); // Volta ao feed principal após registar
            }}
            onShowToast={addToast}
          />
        )}

        {activeTab === 2 && (
          <InventoryList onShowToast={addToast} />
        )}

        {activeTab === 3 && (
          <ProtectedClients onShowToast={addToast} />
        )}

        {activeTab === 4 && (
          <ProfileView
            onLogout={handleLogout}
            onShowToast={addToast}
          />
        )}
      </main>

      {/* =========================================================================
          BOTTOM NAVIGATION BAR (5 TABS MOBILE-FIRST)
          ========================================================================= */}
      <nav
        aria-label="Navegação Operacional"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#1F2937]/95 backdrop-blur-lg border-t border-gray-800 shadow-2xl safe-area-pb"
      >
        <div className="max-w-md sm:max-w-lg mx-auto px-2 h-16 flex items-center justify-around">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === index;

            if (item.isPrimary) {
              return (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className="flex flex-col items-center justify-center -mt-5 group focus:outline-none cursor-pointer"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform duration-150 active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-tr from-[#D4AF37] to-[#f3cf65] text-gray-950 ring-4 ring-[#D4AF37]/30 scale-105'
                        : 'bg-[#D4AF37] text-gray-950 hover:scale-105 shadow-[#D4AF37]/20'
                    }`}
                  >
                    <Icon className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span
                    className={`text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap ${
                      isActive ? 'text-[#D4AF37]' : 'text-gray-300 group-hover:text-[#D4AF37]'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex-1 min-h-[48px] py-1 flex flex-col items-center justify-center transition-colors cursor-pointer group ${
                  isActive ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 stroke-[2.2]' : 'group-hover:scale-105'
                  }`}
                />
                <span
                  className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                    isActive ? 'font-bold text-[#D4AF37]' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
