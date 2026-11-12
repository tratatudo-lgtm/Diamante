// PATH: src/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserSessionData, Funcionario } from '../types/database';

interface AuthContextType {
  userSession: UserSessionData | null;
  funcionario: Funcionario | null;
  role: string | null;
  lojaId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  errorMessage: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; redirectPath: string }>;
  setDirectSession: (user: Partial<UserSessionData>, assignedRole: string, token?: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userSession, setUserSession] = useState<UserSessionData | null>(null);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(isSupabaseConfigured());

  // Helper to fetch session data via RPC or funcionarios table fallback
  const fetchSessionMetadata = useCallback(async (userEmail: string, userId: string): Promise<UserSessionData | null> => {
    try {
      // 1. Primary: await supabase.rpc('get_user_session_data')
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_session_data');
      
      if (!rpcError && rpcData) {
        const metadata = Array.isArray(rpcData) ? (rpcData[0] as UserSessionData) : (rpcData as UserSessionData);
        if (metadata && (metadata.ativo === false)) {
          throw new Error('Conta inativa');
        }
        return metadata;
      }

      // 2. Fallback: Query funcionarios table if RPC is not defined or has signature mismatch
      const { data: funcData, error: funcError } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (!funcError && funcData) {
        if (funcData.ativo === false) {
          throw new Error('Conta inativa');
        }
        return {
          id: funcData.id,
          user_id: userId,
          email: funcData.email,
          nome_completo: funcData.nome_completo,
          role: funcData.role,
          loja_id: funcData.loja_id,
          ativo: funcData.ativo,
        };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Conta inativa') {
        throw err;
      }
      console.warn('Erro ao obter metadados de sessão:', err);
    }
    return null;
  }, []);

  const applySession = (data: UserSessionData) => {
    setUserSession(data);
    setRole(data.role);
    setLojaId(data.loja_id || null);
    setFuncionario({
      id: data.id,
      nome_completo: data.nome_completo,
      email: data.email,
      role: data.role,
      loja_id: data.loja_id || null,
      ativo: true,
    });
  };

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiToken = sessionStorage.getItem('diamante_jwt_token');
      if (apiToken) {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.user?.id || payload.user.ativo !== true) {
          sessionStorage.removeItem('diamante_jwt_token');
          setUserSession(null);
          setFuncionario(null);
          setRole(null);
          setLojaId(null);
          return;
        }
        applySession(payload.user as UserSessionData);
        return;
      }

      if (!isSupabaseConfigured()) {
        setUserSession(null);
        setFuncionario(null);
        setRole(null);
        setLojaId(null);
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        setUserSession(null);
        setFuncionario(null);
        setRole(null);
        setLojaId(null);
        return;
      }

      const metadata = await fetchSessionMetadata(session.user.email || '', session.user.id);
      if (!metadata || metadata.id !== session.user.id || metadata.ativo === false || !metadata.role) {
        await supabase.auth.signOut();
        setUserSession(null);
        setFuncionario(null);
        setRole(null);
        setLojaId(null);
        return;
      }
      applySession(metadata);
    } catch (err) {
      console.warn('[AuthContext] Falha ao restaurar sessão:', err);
      sessionStorage.removeItem('diamante_jwt_token');
      setUserSession(null);
      setFuncionario(null);
      setRole(null);
      setLojaId(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSessionMetadata]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  /**
   * FLUXO EXATO REQUISITO 1:
   * 1. signInWithPassword(email, password)
   * 2. Se sucesso -> await supabase.rpc('get_user_session_data')
   * 3. Guardar resultado em State/Context
   * 4. Redirecionar: role==='admin' -> /dashboard-admin | else -> /loja-atual
   * 5. Erros: Mostrar mensagem genérica "Credenciais inválidas ou conta inativa"
   */
  const login = async (email: string, password: string): Promise<{ success: boolean; redirectPath: string }> => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      // 1. signInWithPassword
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData?.user) {
        throw new Error('Credenciais inválidas ou conta inativa');
      }

      // 2. await supabase.rpc('get_user_session_data')
      let sessionData: UserSessionData | null = null;
      try {
        sessionData = await fetchSessionMetadata(authData.user.email || email, authData.user.id);
      } catch {
        // If inactive, force sign out and throw standard error
        await supabase.auth.signOut();
        throw new Error('Credenciais inválidas ou conta inativa');
      }

      // If user is marked inactive in metadata or funcionarios
      if (!sessionData || sessionData.id !== authData.user.id || sessionData.ativo === false || !sessionData.role) {
        await supabase.auth.signOut();
        throw new Error('Credenciais inválidas ou conta inativa');
      }

      // 3. Guardar resultado no Context
      const assignedRole = sessionData.role;
      const assignedLojaId = sessionData?.loja_id || null;

      const fullSession: UserSessionData = {
        id: sessionData.id,
        user_id: authData.user.id,
        email: authData.user.email || email,
        nome_completo: sessionData.nome_completo || email.split('@')[0],
        role: assignedRole,
        loja_id: assignedLojaId,
        ativo: true,
      };

      setUserSession(fullSession);
      setRole(assignedRole);
      setLojaId(assignedLojaId);
      setFuncionario({
        id: fullSession.id || authData.user.id,
        nome_completo: fullSession.nome_completo || 'Utilizador',
        email: fullSession.email || email,
        role: assignedRole,
        loja_id: assignedLojaId,
        ativo: true,
      });

      // 4. Redirecionar: role === 'admin' -> /dashboard-admin | else -> /loja-atual
      const redirectPath = assignedRole === 'admin' ? '/dashboard-admin' : '/loja-atual';
      setIsLoading(false);
      return { success: true, redirectPath };

    } catch (err: unknown) {
      setIsLoading(false);
      console.warn('Erro de autenticação:', err);
      // 5. Erros: Mensagem genérica estrita
      const msg = 'Credenciais inválidas ou conta inativa';
      setErrorMessage(msg);
      return { success: false, redirectPath: '/login' };
    }
  };

  const setDirectSession = (user: Partial<UserSessionData>, assignedRole: string, token?: string) => {
    if (!token || !user.id || !assignedRole) throw new Error('Sessão de API inválida.');
    const fullSession: UserSessionData = {
      id: user.id,
      user_id: user.user_id || user.id,
      email: user.email || '',
      nome_completo: user.nome_completo || 'Utilizador',
      role: assignedRole,
      loja_id: user.loja_id || null,
      ativo: true,
    };

    setUserSession(fullSession);
    setRole(assignedRole);
    setLojaId(user.loja_id || null);
    setFuncionario({
      id: fullSession.id,
      nome_completo: fullSession.nome_completo || 'Utilizador',
      email: fullSession.email,
      role: assignedRole,
      loja_id: fullSession.loja_id || null,
      ativo: true,
    });
    setErrorMessage(null);

    if (token) {
      try {
        sessionStorage.setItem('diamante_jwt_token', token);
      } catch {}
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem('diamante_jwt_token');
      localStorage.removeItem('otp_phone');
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] Erro ao terminar sessão:', err);
    } finally {
      setUserSession(null);
      setFuncionario(null);
      setRole(null);
      setLojaId(null);
      setErrorMessage(null);
    }
  };

  const refreshSession = async () => {
    setIsConfigured(isSupabaseConfigured());
    await restoreSession();
  };

  const clearError = () => setErrorMessage(null);

  const isAuthenticated = Boolean(userSession || funcionario);

  return (
    <AuthContext.Provider
      value={{
        userSession,
        funcionario,
        role,
        lojaId,
        isAuthenticated,
        isLoading,
        isConfigured,
        errorMessage,
        login,
        setDirectSession,
        logout,
        refreshSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
