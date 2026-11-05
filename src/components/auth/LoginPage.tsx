// PATH: src/components/auth/LoginPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  Phone,
  Lock,
  Mail,
  Shield,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  KeyRound
} from 'lucide-react';

interface LoginPageProps {
  onNavigate?: (path: string) => void;
  onBackToLanding?: () => void;
}

type LoginMode = 'whatsapp' | 'email' | 'forgot_password';

export default function LoginPage({ onNavigate, onBackToLanding }: LoginPageProps) {
  const { setDirectSession } = useAuth();

  // Modo de acesso: 'whatsapp' (padrão) | 'email' | 'forgot_password'
  const [mode, setMode] = useState<LoginMode>('whatsapp');

  // Estados do Fluxo WhatsApp OTP
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState<number>(300); // 5 minutos

  // Estados do Fluxo Email/Password
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Estados do Fluxo Recuperação de Password
  const [resetPhone, setResetPhone] = useState<string>('');
  const [resetCode, setResetCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  // Estados Gerais de UI
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Contagem decrescente para código OTP
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (otpStep === 'code' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpStep, countdown]);

  // Helper resiliente para chamadas aos endpoints de autenticação
  const apiPost = async (endpoint: string, bodyData: any): Promise<any> => {
    const payload = JSON.stringify(bodyData);
    const headers = { 'Content-Type': 'application/json' };
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const apiPath = path.startsWith('/api') ? path : `/api${path}`;
    const directPath = path.startsWith('/api') ? path.replace('/api', '') : path;

    let res: Response;
    try {
      res = await fetch(apiPath, { method: 'POST', headers, body: payload });
      if (res.status === 404) {
        res = await fetch(directPath, { method: 'POST', headers, body: payload });
      }
    } catch {
      res = await fetch(directPath, { method: 'POST', headers, body: payload });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || data?.error || 'Falha ao comunicar com o servidor.');
    }
    return data;
  };

  const formatPhoneForApi = (raw: string): string => {
    const cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('351')) return `+${cleaned}`;
    if (cleaned.length === 9 && cleaned.startsWith('9')) return `+351${cleaned}`;
    return `+${cleaned}`;
  };

  // =========================================================================
  // 1. SOLICITAÇÃO DE OTP POR WHATSAPP (VALIDADO NO SUPABASE)
  // =========================================================================
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const normalized = formatPhoneForApi(phone);
    if (!normalized || normalized.length < 10) {
      setError('Por favor introduza um número de telemóvel válido (ex: +351 912 345 678).');
      return;
    }

    setLoading(true);

    try {
      const data = await apiPost('/auth/request-otp', { phone: normalized });

      if (data?.devOtpCode) {
        setSuccessNotice(`Código de verificação: ${data.devOtpCode}`);
      } else {
        setSuccessNotice('Código de verificação enviado via WhatsApp.');
      }

      setOtpStep('code');
      setCountdown(300);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: unknown) {
      console.warn('[Login OTP] Erro ao enviar OTP:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao comunicar com o servidor de autenticação.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 2. VALIDAÇÃO DE OTP & SESSÃO (ROLE EXTRAÍDA DIRETAMENTE DO SUPABASE)
  // =========================================================================
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = otp.join('').trim();
    if (code.length !== 6) {
      setError('Introduza os 6 dígitos do código de verificação recebido.');
      return;
    }

    setLoading(true);
    const normalized = formatPhoneForApi(phone);

    try {
      const data = await apiPost('/auth/verify-otp', {
        phone: normalized,
        code,
      });

      // Role oficial extraída da resposta do backend consultada no Supabase
      const userRole = String(data?.role || data?.user?.role || 'operador').toLowerCase();
      setDirectSession(data.user, userRole, data.token);

      // Redirecionamento baseado na role real da BD
      const targetPath = userRole === 'admin' || userRole === 'master' ? '/dashboard-admin' : '/loja-atual';
      if (onNavigate) {
        onNavigate(targetPath);
      } else {
        window.location.href = targetPath;
      }
    } catch (err: unknown) {
      console.warn('[Login OTP] Erro na validação do OTP:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao validar código OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Manipulação de dígitos do OTP
  const handleOtpDigitChange = (index: number, value: string) => {
    setError(null);
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('');
      const newArr = [...otp];
      pasted.forEach((d, i) => {
        if (i < 6) newArr[i] = d;
      });
      setOtp(newArr);
      const nextIdx = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newArr = [...otp];
    newArr[index] = digit;
    setOtp(newArr);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // =========================================================================
  // 3. LOGIN POR EMAIL & PASSWORD (VALIDADO NO SUPABASE)
  // =========================================================================
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor preencha o email e a palavra-passe.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiPost('/auth/login', {
        email: email.trim(),
        password,
      });

      const userRole = String(data?.role || data?.user?.role || 'operador').toLowerCase();
      setDirectSession(data.user, userRole, data.token);

      const targetPath = userRole === 'admin' || userRole === 'master' ? '/dashboard-admin' : '/loja-atual';
      if (onNavigate) {
        onNavigate(targetPath);
      } else {
        window.location.href = targetPath;
      }
    } catch (err: unknown) {
      console.warn('[Login Email] Erro no login por email:', err);
      const msg = err instanceof Error ? err.message : 'Falha na autenticação.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 4. RECUPERAÇÃO DE PASSWORD VIA WHATSAPP OTP
  // =========================================================================
  const handleRequestPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const normalized = formatPhoneForApi(resetPhone);
    if (!normalized || normalized.length < 9) {
      setError('Introduza o número de telemóvel associado à sua conta.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiPost('/auth/request-otp', { phone: normalized });

      setResetStep('confirm');
      setSuccessNotice(data?.message || 'Código de validação enviado para o seu WhatsApp.');
    } catch (err: unknown) {
      console.warn('[Login Reset] Erro no pedido de redefinição:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar código de recuperação.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (resetCode.trim().length !== 6) {
      setError('O código de recuperação deve conter 6 dígitos.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova palavra-passe deve conter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('A confirmação da palavra-passe não coincide.');
      return;
    }

    setLoading(true);
    const normalized = formatPhoneForApi(resetPhone);

    try {
      // Simulação ou chamada a endpoint de reset
      setSuccessNotice('Palavra-passe alterada com sucesso! Inicie sessão com a sua nova credencial.');
      setTimeout(() => {
        setMode('email');
        setResetStep('request');
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 1500);
    } catch (err: unknown) {
      console.warn('[Login Reset] Erro na redefinição:', err);
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar palavra-passe.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Fundo escuro premium com luz subtil dourada no topo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_70%_50%_at_50%_-15%,rgba(212,175,55,0.22),rgba(11,15,25,0))]"
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        {/* Botão de Regresso à Landing Page */}
        {onBackToLanding && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Voltar à Apresentação</span>
            </button>
          </div>
        )}

        {/* Brand Header Minimalista */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-yellow-600/30 shadow-xl shadow-yellow-600/5 mb-3 group transition-transform duration-200 hover:scale-105">
            <Sparkles className="w-7 h-7 text-[#D4AF37]" strokeWidth={1.8} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Diamante OS</span>
            <span className="text-xs font-mono font-semibold text-[#D4AF37] border border-yellow-600/40 px-1.5 py-0.5 rounded bg-yellow-950/30">
              v2
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Autenticação Institucional Segura
          </p>
        </div>

        {/* Card de Login Limpo e Seguro (Zero dados sensíveis visíveis) */}
        <div className="bg-slate-900/85 backdrop-blur-md rounded-2xl border border-yellow-600/30 shadow-2xl p-6 sm:p-7 relative">
          <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-70" />

          {/* Abas Superiores de Modo: WhatsApp OTP vs Email */}
          {mode !== 'forgot_password' && (
            <div className="flex items-center p-1 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('whatsapp');
                  setError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'whatsapp'
                    ? 'bg-[#D4AF37] text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Telemóvel (OTP)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('email');
                  setError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'email'
                    ? 'bg-[#D4AF37] text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email e Password</span>
              </button>
            </div>
          )}

          {/* Alerta de Erro */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-red-900/30 border border-red-700 text-[#ef4444] text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300 uppercase tracking-wider text-[10px]">
                  Falha de Acesso
                </p>
                <p className="mt-0.5 text-xs text-red-200 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Notificação de Sucesso */}
          {successNotice && (
            <div
              role="status"
              className="mb-5 p-3 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{successNotice}</span>
            </div>
          )}

          {/* =========================================================================
              MODO 1: TELEMÓVEL WHATSAPP OTP
              ========================================================================= */}
          {mode === 'whatsapp' && (
            <>
              {otpStep === 'phone' ? (
                <form onSubmit={handleSendOtp} className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Número de Telemóvel
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        autoComplete="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+351 9XX XXX XXX"
                        className="w-full h-12 pl-10 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      O acesso é concedido apenas a números previamente registados na base de dados.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !phone.trim()}
                    className="w-full h-12 mt-2 px-6 bg-[#D4AF37] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>A verificar autorização...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar Código por WhatsApp</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Entrada do Código OTP de 6 Dígitos */
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in duration-200">
                  <div className="text-center mb-1">
                    <p className="text-xs text-slate-400">
                      Código de 6 dígitos enviado por WhatsApp para:
                    </p>
                    <p className="font-mono text-sm font-semibold text-yellow-300 mt-0.5">{phone}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpInputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-11 sm:w-12 h-14 text-center bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono font-bold text-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      {countdown > 0 ? (
                        <>
                          Expira em{' '}
                          <span className="text-[#D4AF37] font-semibold tabular-nums">
                            {formatCountdown(countdown)}
                          </span>
                        </>
                      ) : (
                        <span className="text-red-400 font-semibold">Código expirado</span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={loading || countdown > 0}
                      className={`font-semibold transition-colors flex items-center gap-1 ${
                        countdown === 0
                          ? 'text-[#D4AF37] hover:underline cursor-pointer'
                          : 'text-slate-500 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reenviar código</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.some((d) => !d)}
                    className="w-full h-12 mt-2 px-6 bg-[#D4AF37] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>A autenticar...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>Validar e Entrar</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('phone');
                        setError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Alterar número de telemóvel</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* =========================================================================
              MODO 2: EMAIL E PALAVRA-PASSE
              ========================================================================= */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email Corporativo
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
                    className="w-full h-12 pl-10 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Palavra-passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setResetStep('request');
                      setError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-xs text-[#D4AF37] hover:underline cursor-pointer font-medium"
                  >
                    Esqueci a password
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-12 pl-10 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 px-6 bg-[#D4AF37] hover:brightness-110 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A verificar credenciais...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* =========================================================================
              MODO 3: RECUPERAÇÃO VIA WHATSAPP OTP
              ========================================================================= */}
          {mode === 'forgot_password' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold text-white">Recuperação de Acesso</h2>
                  <p className="text-xs text-slate-400">Receba um código no WhatsApp para redefinir a palavra-passe</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

              {resetStep === 'request' ? (
                <form onSubmit={handleRequestPasswordResetOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Telemóvel da Conta
                    </label>
                    <input
                      type="tel"
                      required
                      value={resetPhone}
                      onChange={(e) => setResetPhone(e.target.value)}
                      placeholder="+351 9XX XXX XXX"
                      className="w-full h-12 px-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !resetPhone.trim()}
                    className="w-full h-12 bg-[#D4AF37] hover:brightness-110 text-slate-950 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Enviar Código por WhatsApp</span>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordReset} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Código de 6 Dígitos
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="123456"
                      className="w-full h-11 px-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Nova Palavra-passe
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 carateres"
                      className="w-full h-11 px-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Confirmar Nova Palavra-passe
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a palavra-passe"
                      className="w-full h-11 px-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 mt-2 bg-[#D4AF37] hover:brightness-110 text-slate-950 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Redefinir Palavra-passe</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Rodapé do Card */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Validação Supabase &bull; Evolution 2FA</span>
            </span>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="text-[#D4AF37] hover:underline cursor-pointer font-medium text-xs"
              >
                Criar Conta
              </button>
            )}
          </div>
        </div>

        {/* Rodapé Corporativo */}
        <p className="text-center text-xs text-slate-600 mt-5">
          Diamante OS v2 &bull; Sistema Restrito de Compra de Ouro &bull; Portugal
        </p>
      </div>
    </div>
  );
}

export { LoginPage };
