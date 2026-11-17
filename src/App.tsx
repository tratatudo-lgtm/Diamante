// PATH: src/App.tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminDashboard as AdminWarRoomDashboard } from './components/admin/AdminDashboard_old_operational';
import { AdminTransactionsPage } from './components/admin/AdminTransactionsPage';
import { AdminPageLayout } from './components/admin/AdminPageLayout';
import { AdminLojasPage } from './components/admin/AdminLojasPage';
import { AdminFuncionariosPage } from './components/admin/AdminFuncionariosPage';
import { AdminConfigPage } from './components/admin/AdminConfigPage';
import { StoreOperatorView } from './components/store/StoreOperatorView';
import { StoreManagement } from './components/stores/StoreManagement';
import { FinanceManagement } from './components/finance/FinanceManagement';
import { ClientManagement } from './components/clients/ClientManagement';
import { CRMWorkspace } from './components/clients/CRMWorkspace';
import { SettingsPage } from './components/settings/SettingsPage';
import { LogAuditPage } from './components/admin/LogAuditPage';
import { CollaborationWorkspace } from './components/collaboration/CollaborationWorkspace';
import { AdminTasksPage } from './components/admin/AdminTasksPage';
import { AdminGoalsPage } from './components/admin/AdminGoalsPage';
import { CommercialOpportunitiesPage } from './components/admin/CommercialOpportunitiesPage';
import { ExpansionSitesPage } from './components/admin/ExpansionSitesPage';
import { GoldReceivingPage } from './components/admin/GoldReceivingPage';
import { GoldRefiningPage } from './components/admin/GoldRefiningPage';
import { RefiningProfitabilityPage } from './components/admin/RefiningProfitabilityPage';
import { Loader2 } from 'lucide-react';
import { getPortalMode, getPortalUrlForRole, isRoleAllowedOnPortal } from './config/portal-routing';

function AppRouter() {
  const { isAuthenticated, role, userSession, isLoading } = useAuth();
  const portalMode = typeof window !== 'undefined' ? getPortalMode(window.location.hostname) : 'app';

  const isAdmin =
    role === 'admin' ||
    userSession?.role === 'admin';

  // Rotas suportadas: '/', '/login', '/register', '/dashboard-admin', '/admin/lojas', '/admin/funcionarios', '/admin/config', '/loja-atual'
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (
        p === '/dashboard-admin' ||
        p === '/admin/lojas' ||
        p === '/admin/funcionarios' ||
        p === '/admin/config' ||
        p === '/admin/transacoes' ||
        p === '/admin/recepcao-ouro' ||
        p === '/admin/lotes-fundicao' ||
        p === '/admin/rentabilidade-ouro' ||
        p === '/admin/transacoes-pendentes' ||
        p === '/admin/logs' ||
        p === '/collaboration' ||
        p === '/tasks' ||
        p === '/admin/tasks' ||
        p === '/goals' ||
        p === '/admin/goals' ||
        p === '/opportunities' ||
        p === '/admin/opportunities' ||
        p === '/expansion-sites' ||
        p === '/admin/expansion-sites' ||
        p === '/reportar-situacao' ||
        p === '/logs' ||
        p === '/auditoria' ||
        p === '/loja-atual' ||
        p === '/stores' ||
        p === '/gestao-lojas' ||
        p === '/employees' ||
        p === '/equipa' ||
        p === '/gestao-funcionarios' ||
        p === '/finance' ||
        p === '/financeiro' ||
        p === '/tesouraria' ||
        p === '/clients' ||
        p === '/clientes' ||
        p === '/fornecedores' ||
        p === '/settings' ||
        p === '/configuracoes' ||
        p === '/login' ||
        p === '/register'
      ) {
        return p;
      }
    }
    return '/';
  });

  const navigate = (path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Cada subdomínio é um portal separado; a autorização continua a ser validada pelo backend.
  useEffect(() => {
    if (isLoading || !isAuthenticated || portalMode === 'public' || portalMode === 'app') return;

    if (!isRoleAllowedOnPortal(portalMode, role || userSession?.role)) {
      window.location.replace(getPortalUrlForRole(role || userSession?.role));
    }
  }, [isAuthenticated, isLoading, portalMode, role, userSession?.role]);

  // Redirecionamento e proteção de rotas
  useEffect(() => {
    if (!isLoading) {
      if (portalMode === 'public') {
        if (currentPath !== '/') navigate('/');
        return;
      }
      if ((portalMode === 'store' || portalMode === 'admin') && currentPath === '/') {
        navigate('/login');
        return;
      }
      if (currentPath === '/register') {
        navigate('/login');
        return;
      }
      const isAdminRoute = currentPath.startsWith('/admin') || currentPath === '/dashboard-admin';

      if (isAuthenticated) {
        // Se estiver autenticado e tentar aceder a login/register/landing, direciona para o painel apropriado
        if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
          const target = isAdmin ? '/dashboard-admin' : '/loja-atual';
          navigate(target);
          return;
        }

        // Se tentar aceder a rotas admin sem privilégios de administrador, redireciona para a visão de loja
        if (isAdminRoute && !isAdmin) {
          navigate('/loja-atual');
          return;
        }
      } else {
        // Se não estiver autenticado e tentar aceder a rota protegida
        if (isAdminRoute || currentPath === '/loja-atual' || currentPath === '/collaboration' || currentPath === '/reportar-situacao' || currentPath === '/tasks' || currentPath === '/goals') {
          navigate('/login');
        }
      }
    }
  }, [isAuthenticated, role, userSession, isAdmin, isLoading, currentPath, portalMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center text-[#D4AF37]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-3 text-xs tracking-wider font-mono text-slate-400">
          DIAMANTE OS v2 &bull; A SINCRONIZAR SESSÃO...
        </p>
      </div>
    );
  }

  // O domínio principal é exclusivamente institucional, mesmo para sessões já autenticadas.
  if (portalMode === 'public') {
    return <LandingPage />;
  }

  // 2. Ecrã de Login Centralizado
  if (currentPath === '/login') {
    return (
      <LoginPage
        onNavigate={navigate}
        onBackToLanding={() => navigate('/')}
      />
    );
  }

  // 3. Ecrã de Apresentação Pré-Login (Landing Page Oficial)
  if ((!isAuthenticated && portalMode === 'app') || currentPath === '/') {
    return <LandingPage onAccessSystem={() => navigate('/login')} />;
  }

  // 4. Sala de Operações de Loja
  if (currentPath === '/loja-atual') {
    return <StoreOperatorView onNavigate={navigate} />;
  }

  if (currentPath === '/expansion-sites' || currentPath === '/admin/expansion-sites') {
    return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><ExpansionSitesPage /></AdminPageLayout>;
  }

  if (currentPath === '/opportunities' || currentPath === '/admin/opportunities') {
    return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><CommercialOpportunitiesPage /></AdminPageLayout>;
  }

  if (currentPath === '/goals' || currentPath === '/admin/goals') {
    return isAdmin
      ? <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><AdminGoalsPage /></AdminPageLayout>
      : <AdminGoalsPage />;
  }

  if (currentPath === '/tasks' || currentPath === '/admin/tasks') {
    return isAdmin
      ? <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><AdminTasksPage onNavigate={navigate} /></AdminPageLayout>
      : <AdminTasksPage onNavigate={navigate} />;
  }

  if (currentPath === '/collaboration' || currentPath === '/reportar-situacao') {
    const initialSection = currentPath === '/reportar-situacao' ? 'reports' : 'chat';
    return isAdmin
      ? <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><CollaborationWorkspace initialSection={initialSection} onNavigate={navigate} /></AdminPageLayout>
      : <CollaborationWorkspace initialSection={initialSection} onNavigate={navigate} />;
  }

  // 5. Rotas Administrativas (Apenas se AuthContext confirmar role='admin')
  if (isAdmin) {
    if (currentPath === '/admin/rentabilidade-ouro') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><RefiningProfitabilityPage /></AdminPageLayout>;
    }
    if (currentPath === '/admin/lotes-fundicao') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><GoldRefiningPage /></AdminPageLayout>;
    }
    if (currentPath === '/admin/recepcao-ouro') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><GoldReceivingPage /></AdminPageLayout>;
    }
    if (currentPath === '/admin/transacoes') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><AdminTransactionsPage onNavigate={navigate} /></AdminPageLayout>;
    }
    if (currentPath === '/admin/transacoes-pendentes') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><AdminTransactionsPage onNavigate={navigate} initialStatus="pendente_aprovacao" /></AdminPageLayout>;
    }
    if (currentPath === '/dashboard-admin') {
      return <AdminWarRoomDashboard onNavigate={navigate} />;
    }
    if (currentPath === '/admin/lojas') {
      return <AdminLojasPage onNavigate={navigate} />;
    }
    if (currentPath === '/admin/funcionarios') {
      return <AdminFuncionariosPage onNavigate={navigate} />;
    }
    if (currentPath === '/admin/config') {
      return <AdminConfigPage onNavigate={navigate} />;
    }
    if (currentPath === '/stores' || currentPath === '/gestao-lojas') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><StoreManagement /></AdminPageLayout>;
    }
    if (currentPath === '/employees' || currentPath === '/equipa' || currentPath === '/gestao-funcionarios') {
      return <AdminFuncionariosPage onNavigate={navigate} />;
    }
    if (currentPath === '/finance' || currentPath === '/financeiro' || currentPath === '/tesouraria') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><FinanceManagement onNavigate={navigate} /></AdminPageLayout>;
    }
    if (currentPath === '/clients' || currentPath === '/clientes' || currentPath === '/fornecedores') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><CRMWorkspace /></AdminPageLayout>;
    }
    if (currentPath === '/settings' || currentPath === '/configuracoes' || currentPath === '/admin/config') {
      return <AdminPageLayout currentPath={currentPath} onNavigate={navigate}><SettingsPage onNavigate={navigate} /></AdminPageLayout>;
    }
    if (currentPath === '/admin/logs' || currentPath === '/logs' || currentPath === '/auditoria') {
      return <LogAuditPage onNavigate={navigate} />;
    }
    // Rota padrão admin: Sala de Guerra
    return <AdminDashboard onNavigate={navigate} />;
  }

  // Fallback padrão seguro para operadores
  return <StoreOperatorView onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
