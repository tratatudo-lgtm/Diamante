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

type ValidUserSessionData = UserSessionData & {
  id: string;
  nome_completo: string;
  role: string;
  ativo: true;
};

function isValidSessionData(
  data: UserSessionData | null
): data is ValidUserSessionData {
  return Boolean(
    data &&
    typeof data.id === 'string' && data.id.trim() &&
    typeof data.nome_completo === 'string' && data.nome_completo.trim() &&
    typeof data.role === 'string' && data.role.trim() &&
    data.ativo === true
  );
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

  // Os metadados de sessão são obtidos exclusivamente pela RPC protegida.
  // A tabela funcionarios não concede SELECT directo ao cliente autenticado.
  const fetchSessionMetadata = useCallback(async (_userId: string): Promise<UserSessionData | null> => {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_session_data');
      if (rpcError || !rpcData) {
        console.warn('[AuthContext] Falha ao obter metadados de sessão pela RPC.');
        return null;
      }

      const rawMetadata = Array.isArray(rpcData) ? (rpcData[0] as UserSessionData) : (rpcData as UserSessionData);
      const metadata: UserSessionData = rawMetadata ? {
        ...rawMetadata,
        codigo_loja: rawMetadata.codigo_loja ?? (typeof rawMetadata.loja_codigo === 'string' ? rawMetadata.loja_codigo : null),
      } : rawMetadata;
      if (metadata?.ativo === false) {
        throw new Error('Conta inativa');
      }
      return metadata || null;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Conta inativa') throw err;
      console.warn('[AuthContext] Falha ao obter metadados de sessão.');
      return null;
    }
  }, []);

  const applySession = (data: ValidUserSessionData) => {
    setUserSession(data);
    setRole(data.role);
    setLojaId(data.loja_id ?? null);
    setFuncionario({
      id: data.id,
      nome_completo: data.nome_completo,
      email: data.email,
      role: data.role,
      loja_id: data.loja_id ?? null,
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
        if (!response.ok || !isValidSessionData(payload?.user)) {
          sessionStorage.removeItem('diamante_jwt_token');
          setUserSession(null);
          setFuncionario(null);
          setRole(null);
          setLojaId(null);
          return;
        }
        applySession(payload.user);
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

      const metadata = await fetchSessionMetadata(session.user.id);
      if (!isValidSessionData(metadata) || metadata.id !== session.user.id) {
        await supabase.auth.signOut();
        setUserSession(null);
        setFuncionario(null);
        setRole(null);
        setLojaId(null);
        return;
      }
      applySession(metadata);
    } catch (err) {
      console.warn('[AuthContext] Falha ao restaurar sessão.');
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
    if (!isSupabaseConfigured()) {
      setErrorMessage('Serviço de autenticação não configurado.');
      return { success: false, redirectPath: '/login' };
    }
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
        sessionData = await fetchSessionMetadata(authData.user.id);
      } catch {
        // If inactive, force sign out and throw standard error
        await supabase.auth.signOut();
        throw new Error('Credenciais inválidas ou conta inativa');
      }

      // If user is marked inactive in metadata or funcionarios
      if (!isValidSessionData(sessionData) || sessionData.id !== authData.user.id) {
        await supabase.auth.signOut();
        throw new Error('Credenciais inválidas ou conta inativa');
      }

      // 3. Guardar resultado no Context
      const assignedRole = sessionData.role;
      const assignedLojaId = sessionData?.loja_id || null;

      const fullSession: UserSessionData = {
        id: sessionData.id,
        user_id: authData.user.id,
        email: authData.user.email || sessionData.email || email,
        nome_completo: sessionData.nome_completo,
        role: assignedRole,
        loja_id: assignedLojaId,
        loja_nome: sessionData.loja_nome ?? null,
        codigo_loja: sessionData.codigo_loja ?? (typeof sessionData.loja_codigo === 'string' ? sessionData.loja_codigo : null),
        ativo: true,
      };

      setUserSession(fullSession);
      setRole(assignedRole);
      setLojaId(assignedLojaId);
      setFuncionario({
        id: sessionData.id,
        nome_completo: sessionData.nome_completo,
        email: fullSession.email,
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
      console.warn('[AuthContext] Falha no processo de autenticação.');
      // 5. Erros: Mensagem genérica estrita
      const msg = 'Credenciais inválidas ou conta inativa';
      setErrorMessage(msg);
      return { success: false, redirectPath: '/login' };
    }
  };

  const setDirectSession = (user: Partial<UserSessionData>, assignedRole: string, token?: string) => {
    if (
      !token ||
      typeof user.id !== 'string' || !user.id.trim() ||
      typeof user.nome_completo !== 'string' || !user.nome_completo.trim() ||
      typeof assignedRole !== 'string' || !assignedRole.trim()
    ) {
      throw new Error('Sessão de API inválida ou incompleta.');
    }

    const fullSession: UserSessionData = {
      id: user.id,
      user_id: user.user_id || user.id,
      email: user.email,
      nome_completo: user.nome_completo,
      role: assignedRole,
      loja_id: user.loja_id ?? null,
      loja_nome: typeof user.loja_nome === 'string' ? user.loja_nome : null,
      codigo_loja: typeof user.codigo_loja === 'string' ? user.codigo_loja : (typeof user.loja_codigo === 'string' ? user.loja_codigo : null),
      ativo: true,
    };

    setUserSession(fullSession);
    setRole(assignedRole);
    setLojaId(user.loja_id || null);
    setFuncionario({
      id: user.id,
      nome_completo: user.nome_completo,
      email: fullSession.email,
      role: assignedRole,
      loja_id: fullSession.loja_id ?? null,
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
      console.warn('[AuthContext] Falha ao terminar sessão.');
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
