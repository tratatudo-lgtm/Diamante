// PATH: src/App.tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StoreOperatorView } from './components/store/StoreOperatorView';
import { Loader2 } from 'lucide-react';

function AppRouter() {
  const { isAuthenticated, role, isLoading } = useAuth();
  
  // Track path from window.location or internal state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/dashboard-admin' || p === '/loja-atual' || p === '/login') {
        return p;
      }
    }
    return '/login';
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

  // Intelligent redirection after auth state resolution
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (currentPath === '/login' || currentPath === '/') {
          const target = role === 'admin' ? '/dashboard-admin' : '/loja-atual';
          navigate(target);
        }
      } else {
        if (currentPath !== '/login') {
          navigate('/login');
        }
      }
    }
  }, [isAuthenticated, role, isLoading, currentPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center text-[#D4AF37]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-3 text-xs tracking-wider font-mono text-gray-400">
          DIAMANTE OS v2 · A SINCRONIZAR SESSÃO...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || currentPath === '/login') {
    return <LoginPage onNavigate={navigate} />;
  }

  if (currentPath === '/loja-atual') {
    return <StoreOperatorView onNavigate={navigate} />;
  }

  // Admin Dashboard view (default for admin role)
  return <AdminDashboard onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
