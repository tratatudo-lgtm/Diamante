import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured, updateSupabaseClient, getSupabaseConfig } from '../../lib/supabase';
import { Shield, Lock, Mail, AlertCircle, Sparkles, Key, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, errorMessage, clearError, refreshSession } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Supabase quick connect state
  const currentConfig = getSupabaseConfig();
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(currentConfig.url);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(currentConfig.key);
  const [configSuccess, setConfigSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    clearError();

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      onNavigate(result.redirectPath);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrlInput || !supabaseKeyInput) return;

    updateSupabaseClient(supabaseUrlInput, supabaseKeyInput);
    setConfigSuccess(true);
    refreshSession();
    setTimeout(() => {
      setConfigSuccess(false);
      setShowConfigModal(false);
    }, 1200);
  };

  const configured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Background ambient gold gradient glow */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.25),rgba(255,255,255,0))]"
        aria-hidden="true" 
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1F2937] border border-[#D4AF37]/40 shadow-xl shadow-[#D4AF37]/5 mb-4 group transition-transform duration-200 hover:scale-105">
            <div className="relative">
              <Sparkles className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.75} />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Diamante OS <span className="text-xs font-mono font-medium text-[#D4AF37] border border-[#D4AF37]/40 px-1.5 py-0.5 rounded ml-1">v2</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Gestão Central de Compra de Ouro &bull; Sala de Guerra
          </p>
        </div>

        {/* Database Connection Notice if URL/Key not configured */}
        {!configured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Conexão Supabase Requerida</span>
            </div>
            <p className="text-amber-300/80 leading-relaxed">
              Para autenticar com a base real, introduza o URL e a Anon Key do Supabase ou configure o arquivo .env.
            </p>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="mt-1 self-start px-3 py-1.5 bg-[#D4AF37] hover:bg-[#c59f2f] text-gray-950 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              Configurar Conexão Supabase
            </button>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-[#1F2937] rounded-2xl border border-gray-800 shadow-2xl p-7 sm:p-8 relative backdrop-blur-sm">
          {/* Subtle gold accent top hairline */}
          <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-60" />

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Autenticação Segura</h2>
              <p className="text-xs text-gray-400 mt-0.5">Acesso restrito a operadores e administradores</p>
            </div>
            <span className="p-2 rounded-xl bg-gray-800/80 border border-gray-700/60 text-[#D4AF37]">
              <Shield className="w-5 h-5" />
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div 
              role="alert" 
              className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-700/60 text-red-200 text-sm flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-300 text-xs uppercase tracking-wider">Falha de Autenticação</p>
                <p className="text-xs text-red-200 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Email */}
            <div>
              <label 
                htmlFor="email-address" 
                className="block text-xs font-medium uppercase tracking-wider text-gray-300 mb-1.5"
              >
                Email Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@diamante.pt"
                  className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-[#111827] border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-colors"
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-xs font-medium uppercase tracking-wider text-gray-300 mb-1.5"
              >
                Palavra-passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-[#111827] border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-colors"
                />
              </div>
            </div>

            {/* Submit Button (48px+ hitbox) */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[50px] mt-2 px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#e5be40] hover:to-[#d4af37] text-gray-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>A validar sessão...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Connection status footer link */}
          <div className="mt-6 pt-5 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{configured ? 'Base Supabase Conectada' : 'Aguardando Credenciais'}</span>
            </span>

            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-[#D4AF37] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Gerir Chaves</span>
            </button>
          </div>
        </div>

        {/* System security badge */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Diamante OS v2 &bull; Pagamento por Transferência Bancária &bull; Sem Vendas
        </p>
      </div>

      {/* Supabase Connection Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1F2937] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Conexão Supabase Real</h3>
                  <p className="text-xs text-gray-400">Credenciais diretas para a instância</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 mt-5">
              {configSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Conexão configurada com sucesso!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  SUPABASE URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  SUPABASE ANON KEY
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-gray-950 bg-[#D4AF37] hover:bg-[#c59f2f] rounded-lg transition-colors"
                >
                  Guardar & Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
