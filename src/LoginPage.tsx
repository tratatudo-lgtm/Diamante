import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  Phone,
  Lock,
  Shield,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface LoginPageProps {
  onNavigate?: (path: string) => void;
}

export default function LoginPage({ onNavigate }: LoginPageProps) {
  // Estados obrigatórios
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 minutos = 300 segundos

  // Referências para os 6 inputs de OTP
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer de countdown para o código OTP
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (step === 'otp' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, countdown]);

  // Normalização do número de telemóvel para envio à API
  const getNormalizedPhone = (raw: string): string => {
    const cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    if (cleaned.startsWith('351')) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      return `+351${cleaned}`;
    }
    return `+${cleaned}`;
  };

  // Validação em tempo real: regex /^\+?351[9][1236]\d{7}$/
  const validatePhone = (raw: string): boolean => {
    const normalized = getNormalizedPhone(raw);
    const regex = /^\+?351[9][1236]\d{7}$/;
    return regex.test(normalized);
  };

  // Formatação visual do telemóvel à medida que o utilizador digita
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setError(null);

    // Se o utilizador colar ou digitar sem prefixo, facilitamos a digitação
    setPhone(val);
  };

  // Envio de OTP por WhatsApp: POST /api/auth/send-otp
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const normalized = getNormalizedPhone(phone);
    const regex = /^\+?351[9][1236]\d{7}$/;

    if (!regex.test(normalized)) {
      setError('Introduza um número de telemóvel português válido (ex: +351 912 345 678).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: normalized }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          data?.message ||
          data?.error ||
          (response.status === 404
            ? 'Número de telemóvel não encontrado ou não autorizado no sistema.'
            : response.status === 429
            ? 'Demasiadas tentativas. Por favor aguarde alguns instantes.'
            : 'Erro ao enviar o código de verificação por WhatsApp.');
        throw new Error(errorMsg);
      }

      // Sucesso no envio
      setStep('otp');
      setCountdown(300); // 5 minutos
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: unknown) {
      console.error('Erro em send-otp:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível ligar ao servidor. Verifique a sua ligação de rede.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Manipulação de dígitos do OTP
  const handleOtpDigitChange = (index: number, value: string) => {
    setError(null);

    // Tratamento de colar código completo (ex: colar "123456")
    if (value.length > 1) {
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    // Apenas 1 dígito numérico
    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Avançar automaticamente para o input seguinte
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Tratamento da tecla Backspace nos inputs OTP
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Validação e Verificação de OTP: POST /api/auth/verify-otp
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = otp.join('').trim();
    if (code.length !== 6) {
      setError('Por favor introduza o código de 6 dígitos recebido no WhatsApp.');
      return;
    }

    setLoading(true);
    const normalized = getNormalizedPhone(phone);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalized,
          code,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          data?.message ||
          data?.error ||
          (response.status === 401 || response.status === 400
            ? 'Código de verificação incorreto ou expirado.'
            : 'Erro ao validar o código. Tente novamente.');
        throw new Error(errorMsg);
      }

      // Guardar sessão via supabase.auth.setSession()
      if (data?.session?.access_token && data?.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.warn('Aviso ao sincronizar sessão no Supabase:', sessionError);
        }
      }

      // Determinar role do utilizador
      const role =
        data?.user?.role ||
        data?.user?.user_metadata?.role ||
        data?.role ||
        'funcionario';

      // Redirecionamento baseado na role:
      // role === 'admin' -> /dashboard-admin (Sala de Guerra)
      // role === 'funcionario' -> /loja-atual (Sala de Operações)
      const redirectPath = role === 'admin' ? '/dashboard-admin' : '/loja-atual';

      if (onNavigate) {
        onNavigate(redirectPath);
      } else {
        window.location.href = redirectPath;
      }
    } catch (err: unknown) {
      console.error('Erro em verify-otp:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Falha ao autenticar. Verifique o código e tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Formatação de minutos:segundos para o countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isPhoneValid = validatePhone(phone);
  const isOtpComplete = otp.every((digit) => digit.length === 1);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Fundo escuro premium (#0f172a) com gradiente subtil dourado (#D4AF37) no topo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(212,175,55,0.22),rgba(15,23,42,0))]"
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-yellow-600/30 shadow-xl shadow-yellow-600/5 mb-4 group transition-transform duration-200 hover:scale-105">
            <Sparkles className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Diamante OS</span>
            <span className="text-xs font-mono font-semibold text-[#D4AF37] border border-yellow-600/40 px-2 py-0.5 rounded-md bg-yellow-950/30">
              v2
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Acesso Operacional Seguro via WhatsApp OTP
          </p>
        </div>

        {/* Card de Login */}
        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-yellow-600/30 shadow-2xl p-7 sm:p-8 relative">
          {/* Linha superior fina dourada */}
          <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-70" />

          {/* Toast / Alerta de Erro */}
          {error && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-xl bg-red-900/30 border border-red-700 text-[#ef4444] text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300 uppercase tracking-wider text-[10px]">
                  Falha de Autenticação
                </p>
                <p className="mt-0.5 text-xs text-red-200 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* ESTADO 1: Input Telemóvel */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-base font-semibold text-white">Identificação</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Introduza o telemóvel associado à sua conta
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-[#D4AF37]">
                  <Phone className="w-4 h-4" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Número de Telemóvel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone-input"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+351 9XX XXX XXX"
                    className="w-full h-12 pl-10 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-base font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Exemplo: +351 912 345 678 (Operadoras PT)
                </p>
              </div>

              {/* Botão Primário Dourado: Enviar Código por WhatsApp */}
              <button
                type="submit"
                disabled={loading || !phone.trim()}
                className="w-full h-12 mt-2 px-6 bg-[#D4AF37] hover:brightness-110 active:scale-[0.99] text-slate-950 font-semibold text-sm tracking-wide rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A enviar código por WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Código por WhatsApp</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ESTADO 2: Input OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-base font-semibold text-white">Código de Verificação</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enviado por WhatsApp para <span className="font-mono text-slate-200">{phone}</span>
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-[#D4AF37]">
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              {/* 6 Inputs Individuais para Dígitos */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 text-center">
                  Introduza os 6 dígitos
                </label>
                <div className="flex items-center justify-between gap-2">
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
                      className="w-12 h-14 text-center bg-slate-800/50 border border-slate-700 rounded-xl text-white font-mono font-bold text-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-colors"
                    />
                  ))}
                </div>
              </div>

              {/* Countdown & Reenviar Código */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 font-mono">
                  {countdown > 0 ? (
                    <>
                      Código válido por{' '}
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
                  className={`font-semibold transition-colors flex items-center gap-1.5 ${
                    countdown === 0
                      ? 'text-[#D4AF37] hover:underline cursor-pointer'
                      : 'text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reenviar código</span>
                </button>
              </div>

              {/* Botão Primário Dourado: Validar e Entrar */}
              <button
                type="submit"
                disabled={loading || !isOtpComplete}
                className="w-full h-12 mt-3 px-6 bg-[#D4AF37] hover:brightness-110 active:scale-[0.99] text-slate-950 font-semibold text-sm tracking-wide rounded-xl shadow-lg shadow-yellow-600/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A validar código...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Validar e Entrar</span>
                  </>
                )}
              </button>

              {/* Voltar / Alterar número */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
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

          {/* Rodapé do Card */}
          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span>Autenticação Segura 2FA</span>
            </span>

            <span className="font-mono text-[11px] text-slate-400">
              WhatsApp API v2
            </span>
          </div>
        </div>

        {/* Informação Legal & Segurança */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Diamante OS &bull; Compra de Ouro Certificada &bull; Sede & Rede de Lojas
        </p>
      </div>
    </div>
  );
}

export { LoginPage };
