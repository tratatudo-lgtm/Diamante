// PATH: src/components/auth/RegisterPage.tsx

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  Sparkles,
  User,
  Mail,
  Lock,
  Phone,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

/**
 * Validação algorítmica de NIF Português (9 dígitos, prefixo e dígito de controlo módulo 11)
 */
function checkPortugueseNif(nifRaw: string): { isValid: boolean; message: string } {
  const nif = nifRaw.trim();
  if (!nif) return { isValid: false, message: 'Introduza os 9 dígitos do NIF' };
  if (!/^\d{9}$/.test(nif)) {
    return { isValid: false, message: 'O NIF deve conter exatamente 9 algarismos' };
  }

  const firstDigit = nif.charAt(0);
  const validFirstDigits = ['1', '2', '3', '5', '6', '8', '9'];
  if (!validFirstDigits.includes(firstDigit)) {
    return { isValid: false, message: 'Prefixo inicial inválido para NIF português' };
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif.charAt(i), 10) * (9 - i);
  }

  const remainder = sum % 11;
  const expectedCheckDigit = remainder < 2 ? 0 : 11 - remainder;
  const actualCheckDigit = parseInt(nif.charAt(8), 10);

  if (expectedCheckDigit !== actualCheckDigit) {
    return { isValid: false, message: 'Dígito de controlo do NIF incorreto' };
  }

  return { isValid: true, message: 'NIF português válido' };
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { setDirectSession } = useAuth();

  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [telemovel, setTelemovel] = useState('');
  const [nif, setNif] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Validação em tempo real do NIF
  const nifValidation = nif ? checkPortugueseNif(nif) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!nomeCompleto.trim() || !email.trim() || !password) {
      setErrorMessage('Por favor preencha todos os campos obrigatórios.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A palavra-passe deve conter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('A confirmação da palavra-passe não coincide.');
      return;
    }

    if (nif) {
      const nifCheck = checkPortugueseNif(nif);
      if (!nifCheck.isValid) {
        setErrorMessage(`NIF inválido: ${nifCheck.message}`);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Tenta rota /auth/register ou /api/auth/register
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_completo: nomeCompleto.trim(),
          email: email.trim(),
          telemovel: telemovel.trim() || undefined,
          nif: nif.trim() || undefined,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || 'Falha ao processar o registo da conta.');
      }

      setSuccessMessage('Conta registada com sucesso! A iniciar sessão...');

      if (data?.user && data?.role) {
        setDirectSession(data.user, data.role, data.token);
      }

      setTimeout(() => {
        const dest = data?.role === 'admin' ? '/dashboard-admin' : '/loja-atual';
        onNavigate(dest);
      }, 1200);
    } catch (err: unknown) {
      console.error('Erro no registo:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao ligar ao servidor de autenticação.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Fundo escuro premium (#0f172a) com gradiente subtil dourado (#D4AF37) no topo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(212,175,55,0.22),rgba(15,23,42,0))]"
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-yellow-600/30 shadow-xl shadow-yellow-600/5 mb-3">
            <Sparkles className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Diamante OS</span>
            <span className="text-xs font-mono font-semibold text-[#D4AF37] border border-yellow-600/40 px-2 py-0.5 rounded-md bg-yellow-950/30">
              v2
            </span>
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Registo de Operador &bull; Compra de Ouro
          </p>
        </div>

        {/* Card de Registo */}
        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-yellow-600/30 shadow-2xl p-6 sm:p-7 relative">
          <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-70" />

          {/* Mensagens de Sucesso ou Erro */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-red-900/30 border border-red-700 text-[#ef4444] text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300 uppercase tracking-wider text-[10px]">Aviso</p>
                <p className="mt-0.5 text-xs text-red-200 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mb-5 p-3 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome Completo */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Nome Completo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  placeholder="ex: João Miguel Silva"
                  className="w-full h-11 pl-10 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Email Corporativo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@diamante.pt"
                  className="w-full h-11 pl-10 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            {/* NIF Português & Telemóvel (2 Colunas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* NIF com Validação em Tempo Real */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    NIF Português
                  </label>
                  {nifValidation && (
                    <span
                      className={`text-[10px] font-mono ${
                        nifValidation.isValid ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {nifValidation.isValid ? '✓ Válido' : 'Inválido'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    maxLength={9}
                    value={nif}
                    onChange={(e) => setNif(e.target.value.replace(/\D/g, ''))}
                    placeholder="9 dígitos"
                    className={`w-full h-11 pl-9 pr-3 bg-slate-800/50 border rounded-xl text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                      nif && nifValidation?.isValid
                        ? 'border-emerald-600 focus:ring-emerald-500/50'
                        : nif && !nifValidation?.isValid
                        ? 'border-amber-600 focus:ring-amber-500/50'
                        : 'border-slate-700 focus:ring-yellow-500/50'
                    }`}
                  />
                </div>
              </div>

              {/* Telemóvel */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Telemóvel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="tel"
                    value={telemovel}
                    onChange={(e) => setTelemovel(e.target.value)}
                    placeholder="+351 9XX..."
                    className="w-full h-11 pl-9 pr-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Palavra-passe & Confirmação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Palavra-passe *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 carateres"
                    className="w-full h-11 pl-9 pr-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Confirmar *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a palavra-passe"
                    className="w-full h-11 pl-9 pr-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Botão de Submissão Dourado */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 px-6 bg-[#D4AF37] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A criar conta...</span>
                </>
              ) : (
                <>
                  <span>Criar Conta de Acesso</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Voltar ao Login */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Já possui conta? Iniciar Sessão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
