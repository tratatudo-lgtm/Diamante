// PATH: src/App.tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLojasPage } from './components/admin/AdminLojasPage';
import { AdminFuncionariosPage } from './components/admin/AdminFuncionariosPage';
import { AdminConfigPage } from './components/admin/AdminConfigPage';
import { StoreOperatorView } from './components/store/StoreOperatorView';
import { Loader2 } from 'lucide-react';

function AppRouter() {
  const { isAuthenticated, role, userSession, isLoading } = useAuth();

  const isAdmin =
    role === 'admin' ||
    role === 'master' ||
    userSession?.role === 'admin' ||
    userSession?.role === 'master';

  // Rotas suportadas: '/', '/login', '/register', '/dashboard-admin', '/admin/lojas', '/admin/funcionarios', '/admin/config', '/loja-atual'
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (
        p === '/dashboard-admin' ||
        p === '/admin/lojas' ||
        p === '/admin/funcionarios' ||
        p === '/admin/config' ||
        p === '/loja-atual' ||
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

  // Redirecionamento e proteção de rotas
  useEffect(() => {
    if (!isLoading) {
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
        if (isAdminRoute || currentPath === '/loja-atual') {
          navigate('/login');
        }
      }
    }
  }, [isAuthenticated, role, userSession, isAdmin, isLoading, currentPath]);

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

  // 1. Ecrã de Registo
  if (currentPath === '/register') {
    return <RegisterPage onNavigate={navigate} />;
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
  if (!isAuthenticated || currentPath === '/') {
    return <LandingPage onAccessSystem={() => navigate('/login')} />;
  }

  // 4. Sala de Operações de Loja
  if (currentPath === '/loja-atual') {
    return <StoreOperatorView onNavigate={navigate} />;
  }

  // 5. Rotas Administrativas (Apenas se AuthContext confirmar role='admin')
  if (isAdmin) {
    if (currentPath === '/admin/lojas') {
      return <AdminLojasPage onNavigate={navigate} />;
    }
    if (currentPath === '/admin/funcionarios') {
      return <AdminFuncionariosPage onNavigate={navigate} />;
    }
    if (currentPath === '/admin/config') {
      return <AdminConfigPage onNavigate={navigate} />;
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
