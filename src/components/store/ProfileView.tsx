import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  User,
  Shield,
  KeyRound,
  LogOut,
  Building2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Clock,
  ArrowRight
} from 'lucide-react';

interface ProfileViewProps {
  onLogout: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout, onShowToast }) => {
  const { userSession, funcionario } = useAuth();
  
  // Password change form state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('A nova palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As palavras-passe introduzidas não coincidem.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setPasswordError('Supabase não está configurada. A palavra-passe não foi alterada.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      onShowToast('success', 'Palavra-passe alterada com sucesso!', 'Segurança');
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordChange(false);
      }, 1500);
    } catch (err: unknown) {
      console.warn('[Perfil] Falha ao atualizar palavra-passe.');
      const msg = 'Não foi possível atualizar a palavra-passe. Tente novamente.';
      setPasswordError(msg);
      onShowToast('error', 'Falha ao atualizar palavra-passe.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const nome = userSession?.nome_completo || funcionario?.nome_completo || 'Operador de Loja';
  const email = userSession?.email || funcionario?.email || 'operador@diamante.pt';
  const role = userSession?.role || funcionario?.role || 'operador';
  const lojaId = userSession?.loja_id || funcionario?.loja_id || 'Não alocada';

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-24">
      {/* Profile Card Header */}
      <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] shadow-lg">
            <User className="w-7 h-7" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white truncate">{nome}</h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 font-semibold">
                {role}
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-500" />
              <span>{email}</span>
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-6 pt-5 border-t border-gray-800 grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
              Loja Alocada
            </span>
            <p className="font-mono font-medium text-white mt-0.5 truncate">
              {lojaId.length > 12 ? `${lojaId.slice(0, 10)}...` : lojaId}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
              Estado de Conta
            </span>
            <p className="text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ativo
            </p>
          </div>
        </div>
      </div>

      {/* Security & Password Section */}
      <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gray-800 text-[#D4AF37]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Segurança & Credenciais
              </h3>
              <p className="text-[11px] text-gray-400">Proteção de acesso à Sala de Operações</p>
            </div>
          </div>

          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="text-xs font-semibold text-[#D4AF37] hover:underline cursor-pointer"
          >
            {showPasswordChange ? 'Ocultar' : 'Alterar Password'}
          </button>
        </div>

        {showPasswordChange && (
          <form onSubmit={handleUpdatePassword} className="pt-3 border-t border-gray-800 space-y-3">
            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Palavra-passe atualizada com sucesso!</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-700/60 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Nova Palavra-passe
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Confirmar Nova Palavra-passe
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a palavra-passe"
                className="w-full px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full min-h-[44px] bg-[#D4AF37] hover:bg-[#c59f2f] text-gray-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A atualizar...</span>
                </>
              ) : (
                <span>Guardar Nova Password</span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Info & Logout */}
      <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Última Atividade: Sessão atual conectada</span>
          </span>
          <span className="font-mono text-[11px] text-emerald-400">RLS Ativo</span>
        </div>

        {/* Botão de Terminar Sessão (Hitbox 48px+) */}
        <button
          onClick={onLogout}
          className="w-full min-h-[48px] px-4 py-3 bg-red-950/60 hover:bg-red-900/80 text-red-200 font-bold text-xs tracking-wider uppercase rounded-xl border border-red-800/80 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>Terminar Sessão</span>
        </button>
      </div>
    </div>
  );
};
