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
import { StoreOperatorView } from './components/store/StoreOperatorView';
import { Loader2 } from 'lucide-react';

function AppRouter() {
  const { isAuthenticated, role, isLoading } = useAuth();

  // Rotas suportadas: '/', '/login', '/register', '/dashboard-admin', '/loja-atual'
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (
        p === '/dashboard-admin' ||
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

  // Redirecionamento inteligente após resolução de autenticação
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
          const target = role === 'admin' || role === 'master' ? '/dashboard-admin' : '/loja-atual';
          navigate(target);
        }
      }
    }
  }, [isAuthenticated, role, isLoading, currentPath]);

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

  // 5. Sala de Guerra Admin (Painel Central)
  return <AdminDashboard onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
