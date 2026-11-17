import React, { useState, useEffect, useCallback } from 'react';
import { useTransactionRealtime } from '../../hooks/useTransactionRealtime';
import { useAuth } from '../../hooks/useAuth';
import type { Transacao, KpiLojaDiaria, RegistoPonto, Loja } from '../../types/database';
import {
  Coins,
  Scale,
  ClockAlert,
  Package,
  Plus,
  Boxes,
  AlertTriangle,
  LogIn,
  LogOut,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Loader2,
  Send,
  X
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface StoreDashboardProps {
  onNavigateTab: (tabIndex: number) => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string, title?: string) => void;
  selectedStoreId?: string;
}

interface FeedActivity {
  id: string;
  timestamp: string;
  type: 'transacao_aprovada' | 'transacao_pendente' | 'transacao_paga' | 'ponto_entrada' | 'ponto_saida';
  title: string;
  valor?: number;
  funcionarioNome?: string;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({ onNavigateTab, onShowToast, selectedStoreId }) => {
  const { userSession, funcionario } = useAuth();
  const lojaId = selectedStoreId || userSession?.loja_id || funcionario?.loja_id || '';
  const isAdmin = (userSession?.role || funcionario?.role) === 'admin';

  // Data states
  const [lojaInfo, setLojaInfo] = useState<Loja | null>(null);
  const [kpiHoje, setKpiHoje] = useState<KpiLojaDiaria | null>(null);
  const [kpiOntem, setKpiOntem] = useState<KpiLojaDiaria | null>(null);
  const [stockEmLojaCount, setStockEmLojaCount] = useState<number>(0);
  const [stockEmLojaPesoGramas, setStockEmLojaPesoGramas] = useState<number>(0);
  const [comprasPendentesCount, setComprasPendentesCount] = useState<number>(0);
  const [comprasPendentesPesoGramas, setComprasPendentesPesoGramas] = useState<number>(0);
  const [ultimoPonto, setUltimoPonto] = useState<RegistoPonto | null>(null);
  const [isClockedIn, setIsClockedIn] = useState<boolean>(false);
  const [feedActivities, setFeedActivities] = useState<FeedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClocking, setIsClocking] = useState(false);

  // Modal de Alerta/Incidente
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentPriority, setIncidentPriority] = useState<'normal' | 'urgente'>('urgente');
  const [isSendingIncident, setIsSendingIncident] = useState(false);

  // Saudação dinâmica baseada na hora do dia
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 20) return 'Boa tarde';
    return 'Boa noite';
  };

  const funcionarioNome = userSession?.nome_completo || funcionario?.nome_completo || 'Operador';

  // // Todos os dados operacionais são servidos pela API autenticada; a loja é resolvida no servidor.
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão de API não encontrada.');
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
      const response = await fetch('/api/store/dashboard?today=' + todayStr + '&yesterday=' + yesterdayStr + (selectedStoreId ? '&lojaId=' + encodeURIComponent(selectedStoreId) : ''), {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || 'Não foi possível carregar os dados operacionais da loja.');
      }

      setLojaInfo(payload.loja as Loja);
      setKpiHoje(payload.kpiHoje || null);
      setKpiOntem(payload.kpiOntem || null);
      setStockEmLojaCount(Number(payload.stockEmLojaCount) || 0);
      setStockEmLojaPesoGramas(Number(payload.stockEmLojaPesoGramas) || 0);
      setComprasPendentesCount(Number(payload.comprasPendentesCount) || 0);
      setComprasPendentesPesoGramas(Number(payload.comprasPendentesPesoGramas) || 0);

      const points = Array.isArray(payload.pontos) ? payload.pontos as RegistoPonto[] : [];
      const lastPoint = points[0] || null;
      setUltimoPonto(lastPoint);
      setIsClockedIn(!isAdmin && lastPoint?.tipo === 'entrada');

      const transactions = Array.isArray(payload.transacoes) ? payload.transacoes as Transacao[] : [];
      const combined: FeedActivity[] = [];
      transactions.forEach((tx) => {
        let type: FeedActivity['type'] = 'transacao_pendente';
        let title = 'Nova compra registada (' + tx.peso_gramas + 'g)';
        if (tx.estado === 'aprovado') {
          type = 'transacao_aprovada';
          title = 'Compra #' + tx.id.slice(0, 6) + ' aprovada pela sede';
        } else if (tx.estado === 'pago') {
          type = 'transacao_paga';
          title = 'Transferência liquidada para cliente';
        } else if (tx.estado === 'pendente_aprovacao') {
          type = 'transacao_pendente';
          title = 'Compra aguarda aprovação da sede';
        }
        combined.push({ id: 'tx-' + tx.id, timestamp: tx.created_at, type, title, valor: tx.valor_final });
      });
      (isAdmin ? [] : points.slice(0, 3)).forEach((point) => {
        combined.push({
          id: 'pt-' + point.id,
          timestamp: point.timestamp,
          type: point.tipo === 'entrada' ? 'ponto_entrada' : 'ponto_saida',
          title: point.tipo === 'entrada' ? 'Clock In efectuado' : 'Clock Out efectuado',
        });
      });
      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setFeedActivities(combined.slice(0, 5));
    } catch (err) {
      console.warn('[Loja] Falha ao carregar dados do painel.');
      onShowToast('error', err instanceof Error ? err.message : 'Não foi possível sincronizar os dados operacionais.');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast, selectedStoreId, isAdmin]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // A sala é atribuída pelo servidor com base no JWT e na loja do funcionário.
  useTransactionRealtime(loadDashboardData, lojaId ? 'store:' + lojaId : null);

  // Registo de ponto exclusivamente pela API autenticada.
  const handleToggleClock = async () => {
    setIsClocking(true);
    const novoTipo: 'entrada' | 'saida' = isClockedIn ? 'saida' : 'entrada';
    let localizacaoCoords: { lat: number; lng: number } | null = null;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        localizacaoCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        console.warn('[Loja] Geolocalização não disponível.');
      }
    }

    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão expirada. Volte a iniciar sessão.');
      const response = await fetch('/api/store/clock', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tipo: novoTipo, localizacao: localizacaoCoords }),
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !payload?.ponto) {
        throw new Error(payload?.message || 'Não foi possível registar o ponto.');
      }

      setIsClockedIn(novoTipo === 'entrada');
      setUltimoPonto(payload.ponto as RegistoPonto);
      onShowToast('success', novoTipo === 'entrada' ? 'Clock In registado com sucesso!' : 'Clock Out registado com sucesso!', 'Registo de Ponto');
      void loadDashboardData();
    } catch (err) {
      onShowToast('error', err instanceof Error ? err.message : 'Não foi possível registar o ponto. Tente novamente.');
    } finally {
      setIsClocking(false);
    }
  };

  // Submissão do Modal de Alerta à Sede
  const handleSendIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDescription.trim()) return;

    setIsSendingIncident(true);
    try {
      onShowToast(
        'error',
        'O envio de incidentes ainda não está ligado ao backend. Nenhum alerta foi enviado.',
        'Funcionalidade indisponível'
      );
    } catch {
      onShowToast('error', 'Não foi possível transmitir o alerta.');
    } finally {
      setIsSendingIncident(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Variação vs ontem
  const valorHoje = kpiHoje?.total_compras_valor || 0;
  const valorOntem = kpiOntem?.total_compras_valor || 0;
  const deltaOntem = valorOntem > 0 ? ((valorHoje - valorOntem) / valorOntem) * 100 : null;

  return (
    <div className="space-y-5 pb-24">
      {/* =========================================================================
          TAB 1 - A. HEADER
          ========================================================================= */}
      <section className="bg-[#1F2937] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        {/* Subtle decorative gold top bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#D4AF37]">
                {getGreeting()}, {funcionarioNome.split(' ')[0]} 👋
              </span>
              <span className="text-gray-600">·</span>
              <span className="text-xs text-gray-400 capitalize">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {/* Badge da Loja */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-700/80 text-xs text-white">
                <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="font-mono font-bold text-[#D4AF37]">
                  {lojaInfo?.codigo_loja || userSession?.codigo_loja || 'LOJA'}
                </span>
                <span className="text-gray-400">-</span>
                <span className="font-medium truncate max-w-[180px]">
                  {lojaInfo?.nome || userSession?.loja_nome || 'Unidade Operacional'}
                </span>
              </div>

              {!isAdmin && (
              {/* Indicador Status: Online / Offline */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                  isClockedIn
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                    : 'bg-rose-950/60 border-rose-700/60 text-rose-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isClockedIn ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
                <span>{isClockedIn ? 'Turno Ativo (Online)' : 'Fora de Turno (Offline)'}</span>
              </div>
            </div>
          </div>
              )}

          {!isAdmin && (
  
            <button
              onClick={handleToggleClock}
              disabled={isClocking}
              className={`min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98 disabled:opacity-50 shrink-0 ${
                isClockedIn
                  ? 'bg-gray-800 hover:bg-rose-950 text-rose-300 border border-rose-800/60'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              {isClocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A processar...</span>
                </>
              ) : isClockedIn ? (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Efetuar Clock Out</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Efetuar Clock In</span>
                </>
              )}
            </button>
          )}
        </div>

        {ultimoPonto && (
          <p className="mt-3 text-[11px] text-gray-500 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span>
              Último registo: {ultimoPonto.tipo.toUpperCase()} às{' '}
              {format(parseISO(ultimoPonto.timestamp), 'HH:mm')}
            </span>
          </p>
        )}
      </section>

      {/* =========================================================================
          TAB 1 - B. KPIs DO DIA (Scroll Horizontal Mobile)
          ========================================================================= */}
      <section aria-label="KPIs Operacionais do Dia">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5 overflow-x-auto pb-1 no-scrollbar">
          {/* 1. Comprado Hoje */}
          <div className="min-w-[240px] sm:min-w-0 flex-1 bg-[#1F2937] border border-gray-800 rounded-xl p-4 shadow-sm relative">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Comprado Hoje</span>
              <div className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37]">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="mt-3 h-7 w-28 bg-gray-700/60 rounded animate-pulse" />
            ) : (
              <p className="mt-2 text-2xl font-bold font-mono text-[#D4AF37] tabular-nums">
                {formatCurrency(valorHoje)}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400 font-mono">
              {deltaOntem !== null ? (
                <span className={deltaOntem >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {deltaOntem >= 0 ? `+${deltaOntem.toFixed(1)}%` : `${deltaOntem.toFixed(1)}%`} vs ontem
                </span>
              ) : (
                'Primeiro balanço do dia'
              )}
            </p>
          </div>

          {/* 2. Peso Acumulado */}
          <div className="min-w-[220px] sm:min-w-0 flex-1 bg-[#1F2937] border border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Peso Acumulado</span>
              <div className="p-1.5 rounded-lg bg-gray-800 text-gray-300">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="mt-3 h-7 w-24 bg-gray-700/60 rounded animate-pulse" />
            ) : (
              <p className="mt-2 text-2xl font-bold font-mono text-white tabular-nums">
                {kpiHoje?.total_peso_ouro_g ? `${Number(kpiHoje.total_peso_ouro_g).toFixed(1)}g` : '0.0g'}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">Ouro em cofre hoje</p>
          </div>

          {/* 3. Pendentes Sede */}
          <div className="min-w-[220px] sm:min-w-0 flex-1 bg-[#1F2937] border border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Pendentes Sede</span>
              <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/40">
                <ClockAlert className="w-4 h-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="mt-3 h-7 w-16 bg-gray-700/60 rounded animate-pulse" />
            ) : (
              <p className="mt-2 text-2xl font-bold font-mono text-amber-300 tabular-nums">
                {kpiHoje?.pendentes_aprovacao_qtd || 0}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">Aguarda validação de transferência</p>
          </div>

          {/* 4. Stock em Loja */}
          <div className="min-w-[220px] sm:min-w-0 flex-1 bg-[#1F2937] border border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Stock em Loja</span>
              <div className="p-1.5 rounded-lg bg-gray-800 text-gray-300">
                <Package className="w-4 h-4" />
              </div>
            </div>
            {isLoading ? (
              <div className="mt-3 h-7 w-16 bg-gray-700/60 rounded animate-pulse" />
            ) : (
              <p className="mt-2 text-2xl font-bold font-mono text-white tabular-nums">
                {stockEmLojaCount}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">
              {stockEmLojaPesoGramas.toFixed(2)} g disponíveis no cofre
            </p>
            {comprasPendentesCount > 0 && (
              <p className="mt-1 text-[11px] text-amber-300">
                {comprasPendentesCount} pendentes · {comprasPendentesPesoGramas.toFixed(2)} g por aprovar
              </p>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          TAB 1 - C. AÇÃO RÁPIDA (Hitbox 48px+, Dourado 50% largura)
          ========================================================================= */}
      <section aria-label="Ações Rápidas">
        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          {/* [➕ NOVA COMPRA] (Dourado #D4AF37, 50% largura no desktop/mobile flex) */}
          <button
            onClick={() => onNavigateTab(1)}
            className="flex-1 sm:w-1/2 min-h-[52px] px-5 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:from-[#e5be40] hover:to-[#d4af37] text-gray-950 font-bold text-sm tracking-wide rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>NOVA COMPRA</span>
          </button>

          {/* [📦 VER STOCK] */}
          <button
            onClick={() => onNavigateTab(2)}
            className="flex-1 sm:w-1/4 min-h-[52px] px-4 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs tracking-wider uppercase rounded-xl border border-gray-700 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Boxes className="w-4 h-4 text-[#D4AF37]" />
            <span>VER STOCK</span>
          </button>

          {/* [🚨 ALERTA] */}
          <button
            onClick={() => setShowIncidentModal(true)}
            className="w-full sm:w-1/4 min-h-[52px] px-4 py-3.5 bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 font-semibold text-xs tracking-wider uppercase rounded-xl border border-rose-800/80 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>ALERTA SEDE</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          TAB 1 - D. FEED DE ATIVIDADES DA LOJA (Timeline Vertical)
          ========================================================================= */}
      <section aria-label="Feed de Atividades Operacionais">
        <div className="bg-[#1F2937] border border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                Feed de Atividades da Loja
              </h3>
            </div>
            <span className="text-[11px] text-gray-500 font-mono">
              Últimas 5 ações
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
              ))
            ) : feedActivities.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs">
                Sem atividades registadas hoje nesta loja.
              </div>
            ) : (
              feedActivities.map((act) => {
                const actDate = new Date(act.timestamp);
                const timeFormatted = !isNaN(actDate.getTime())
                  ? format(actDate, 'HH:mm')
                  : '--:--';

                return (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* [HH:mm] */}
                      <span className="font-mono text-gray-400 font-medium tabular-nums shrink-0">
                        {timeFormatted}
                      </span>

                      {/* [Ícone] */}
                      <div className="shrink-0">
                        {act.type === 'transacao_aprovada' && (
                          <div className="p-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'transacao_paga' && (
                          <div className="p-1 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60">
                            <Coins className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'transacao_pendente' && (
                          <div className="p-1 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60">
                            <ClockAlert className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'ponto_entrada' && (
                          <div className="p-1 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60">
                            <LogIn className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {act.type === 'ponto_saida' && (
                          <div className="p-1 rounded bg-gray-800 text-gray-400 border border-gray-700">
                            <LogOut className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* [Descrição curta] */}
                      <span className="text-gray-200 font-medium truncate">
                        {act.title}
                      </span>
                    </div>

                    {/* [€Valor se aplicável] */}
                    {act.valor !== undefined && (
                      <span className="font-mono font-bold text-[#D4AF37] tabular-nums shrink-0 text-right">
                        {formatCurrency(act.valor)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          MODAL: ALERTA DE INCIDENTE À SEDE
          ========================================================================= */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#1F2937] border border-rose-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-800/50">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reportar Incidente à Sede</h3>
                  <p className="text-[11px] text-gray-400">Canal direto de segurança operacional</p>
                </div>
              </div>
              <button
                onClick={() => setShowIncidentModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendIncident} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Nível de Prioridade
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIncidentPriority('normal')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                      incidentPriority === 'normal'
                        ? 'bg-amber-950/60 border-amber-600 text-amber-200'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    Operacional / Discrepância
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncidentPriority('urgente')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                      incidentPriority === 'urgente'
                        ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-bold'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    Urgente / Segurança
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Descrição Ocorrência
                </label>
                <textarea
                  rows={4}
                  required
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  placeholder="Descreva o incidente ou suspeita de fraude em loja..."
                  className="w-full px-3.5 py-2.5 bg-[#111827] border border-gray-700 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2.5 text-xs text-gray-300 hover:text-white rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingIncident}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingIncident ? 'A transmitir...' : 'Transmitir Alerta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
