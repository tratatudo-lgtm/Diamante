import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminLojasPage } from './AdminLojasPage';
import { AdminFuncionariosPage } from './AdminFuncionariosPage';
import { AdminConfigPage } from './AdminConfigPage';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  // Estado local que controla EXATAMENTE o que é mostrado
  const [activeTab, setActiveTab] = useState<string>('lojas');

  // Função chamada DIRETAMENTE pelo Sidebar ao clicar
  const handleMenuSelect = (path: string) => {
    // Extrair ID da tab do path (ex: /admin/funcionarios -> funcionarios)
    const tabId = path.replace('/admin/', '').replace('/', '');
    
    // Atualizar estado LOCALMENTE (resposta instantânea)
    setActiveTab(tabId);
    
    // Também notificar o router global (para URL partilhável)
    onNavigate(path);
  };

  // Renderização baseada APENAS no estado local (zero latência)
  const renderContent = () => {
    switch (activeTab) {
      case 'lojas':
      case 'dashboard-admin':
        return <AdminLojasPage onNavigate={handleMenuSelect} />;
      case 'funcionarios':
        return <AdminFuncionariosPage onNavigate={handleMenuSelect} />;
      case 'config':
        return <AdminConfigPage onNavigate={handleMenuSelect} />;
      case 'auditoria':
        return (
          <div className="flex flex-col items-center justify-center h-full text-[#D4AF37]">
            <h2 className="text-2xl font-bold mb-4">Módulo de Auditoria</h2>
            <p className="text-slate-400">Em desenvolvimento...</p>
          </div>
        );
      default:
        return <AdminLojasPage onNavigate={handleMenuSelect} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0b0f19] overflow-hidden">
      {/* Passamos o callback handleMenuSelect para o Sidebar */}
      <AdminSidebar 
        currentPath={`/admin/${activeTab}`} 
        onNavigate={handleMenuSelect} 
      />
      
      {/* Área principal muda INSTANTANEAMENTE conforme activeTab */}
      <main className="flex-1 overflow-auto p-6">
        {renderContent()}
      </main>
    </div>
  );
};