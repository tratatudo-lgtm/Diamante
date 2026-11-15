import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTransactionRealtime } from '../../hooks/useTransactionRealtime';

import { useAuth } from '../../hooks/useAuth';
import type { Loja, LojaComKpi, Transacao, KpiLojaDiaria, GlobalKpiData } from '../../types/database';
import { KPICard } from '../common/KPICard';
import { LiveFeed } from './LiveFeed';
import { DiamanteSidebar } from './DiamanteSidebar';
import { StoreHeatMap } from './StoreHeatMap';
import { StoreTable } from './StoreTable';
import { StoreDetailDrawer } from './StoreDetailDrawer';
import { ToastContainer, type ToastMessage } from '../common/Toast';
import {
  Sparkles,
  Coins,
  ClockAlert,
  Scale,
  Building2,
  RefreshCw,
  LogOut,
  User,
  SlidersHorizontal,
  PlusCircle,
  HelpCircle,
  Users,
  ReceiptText,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  Zap
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { userSession, logout } = useAuth();

  // State
  const [lojas, setLojas] = useState<LojaComKpi[]>([]);
  const [globalKpis, setGlobalKpis] = useState<GlobalKpiData>({
    volumeHoje: 0,
    volumeOntem: 0,
    pendentesHoje: 0,
    pendentesOntem: 0,
    pesoHoje: 0,
    pesoOntem: 0,
    lojasAtivas: 0,
    totalLojas: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLoja, setSelectedLoja] = useState<LojaComKpi | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [recentTxs, setRecentTxs] = useState<Transacao[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [dataError, setDataError] = useState<string | null>(null);

  const addToast = (type: 'success' | 'error' | 'info', message: string, title?: string) => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      title,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Map of stores by ID for rapid lookup in feeds and tooltips
  const lojasMap = useMemo(() => {
    const map: Record<string, Loja> = {};
    lojas.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lojas]);

  // Carregar dados exclusivamente pela API administrativa protegida
  const fetchWarRoomData = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) {
        throw new Error('Sessão administrativa não encontrada. Inicia sessão novamente.');
      }

      const res = await fetch('/api/admin/war-room', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      const apiData = await res.json().catch(() => null);
      if (!res.ok || !apiData?.success) {
        throw new Error(
          typeof apiData?.error === 'string'
            ? apiData.error
            : `Não foi possível carregar a Sala de Guerra (HTTP ${res.status}).`
        );
      }

      const rawLojas: Loja[] = Array.isArray(apiData.lojas) ? apiData.lojas : [];
      const todayTxs: Transacao[] = Array.isArray(apiData.todayTxs) ? apiData.todayTxs : [];
      const allPendingTxs: Array<{ id: string; loja_id: string; valor_final: number; peso_gramas: number; estado: string }> =
        Array.isArray(apiData.allPendingTxs) ? apiData.allPendingTxs : [];
      const kpiToday: KpiLojaDiaria[] = Array.isArray(apiData.kpiToday) ? apiData.kpiToday : [];
      const kpiYesterday: KpiLojaDiaria[] = Array.isArray(apiData.kpiYesterday) ? apiData.kpiYesterday : [];
      const recentTransactions: Transacao[] = Array.isArray(apiData.recentTxs) ? apiData.recentTxs : [];
      const transactionCount = Number(apiData.recentTxsCount) || 0;

      const nonDraftTodayTxs = todayTxs.filter((tx) => tx.estado !== 'rascunho');
      const volumeHoje = nonDraftTodayTxs.reduce((sum, tx) => sum + (Number(tx.valor_final) || 0), 0);
      const pesoHoje = nonDraftTodayTxs.reduce((sum, tx) => sum + (Number(tx.peso_gramas) || 0), 0);
      const pendentesHoje = allPendingTxs.length;

      const volumeOntem = kpiYesterday.reduce(
        (sum, k) => sum + (Number(k.total_compras_valor) || 0),
        0
      );
      const pesoOntem = kpiYesterday.reduce(
        (sum, k) => sum + (Number(k.total_peso_ouro_g) || 0),
        0
      );
      const pendentesOntem = kpiYesterday.reduce(
        (sum, k) => sum + (Number(k.pendentes_aprovacao_qtd) || 0),
        0
      );

      const activeStores = rawLojas.filter((l) => l.ativo !== false).length;

      setGlobalKpis({
        volumeHoje,
        volumeOntem,
        pendentesHoje,
        pendentesOntem,
        pesoHoje,
        pesoOntem,
        lojasAtivas: activeStores,
        totalLojas: rawLojas.length,
      });

      const kpiByLoja: Record<string, Partial<KpiLojaDiaria>> = {};
      kpiToday.forEach((k) => {
        kpiByLoja[k.loja_id] = k;
      });

      const pendingsByLoja: Record<string, number> = {};
      allPendingTxs.forEach((tx) => {
        pendingsByLoja[tx.loja_id] = (pendingsByLoja[tx.loja_id] || 0) + 1;
      });

      const liveVolumeByLoja: Record<string, number> = {};
      nonDraftTodayTxs.forEach((tx) => {
        liveVolumeByLoja[tx.loja_id] = (liveVolumeByLoja[tx.loja_id] || 0) + (Number(tx.valor_final) || 0);
      });

      const mergedLojas: LojaComKpi[] = rawLojas.map((loja) => {
        const kpi = kpiByLoja[loja.id];
        return {
          ...loja,
          total_compras_valor: kpi?.total_compras_valor ?? liveVolumeByLoja[loja.id] ?? 0,
          pendentes_aprovacao_qtd: pendingsByLoja[loja.id] ?? kpi?.pendentes_aprovacao_qtd ?? 0,
          total_compras_qtd: kpi?.total_compras_qtd || 0,
        };
      });

      setLojas(mergedLojas);
      setRecentTxs(recentTransactions);
      setTotalTransactions(transactionCount);
      setIsOnline(true);
      setDataError(null);
    } catch (err: unknown) {
      console.warn('[Sala de Guerra] Falha ao sincronizar dados administrativos.');
      setIsOnline(false);
      setDataError('Não foi possível sincronizar os dados administrativos. Tente novamente.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Carregamento inicial e atualização periódica através da API protegida
  useEffect(() => {
    void fetchWarRoomData();
    const refreshInterval = window.setInterval(() => {
      void fetchWarRoomData();
    }, 30000);

    return () => window.clearInterval(refreshInterval);
  }, [fetchWarRoomData]);

  // Atualização imediata quando uma loja regista uma nova transação.
  useTransactionRealtime(fetchWarRoomData, 'admin');

  const handleOpenLojaDetails = (loja: LojaComKpi) => {
    setSelectedLoja(loja);
    setIsDrawerOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Delta calculations vs yesterday
  const volumeDelta = globalKpis.volumeOntem > 0
    ? ((globalKpis.volumeHoje - globalKpis.volumeOntem) / globalKpis.volumeOntem) * 100
    : 0;

  const pendentesDelta = globalKpis.pendentesOntem > 0
    ? ((globalKpis.pendentesHoje - globalKpis.pendentesOntem) / globalKpis.pendentesOntem) * 100
    : 0;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#070d18] text-slate-100 flex flex-col lg:pl-64 selection:bg-[#D4AF37]/30 selection:text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora-drift absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.07] blur-[100px]" />
        <div className="aurora-drift absolute -right-40 top-24 h-[34rem] w-[34rem] rounded-full bg-amber-400/[0.07] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>
      <DiamanteSidebar currentPath="/dashboard-admin" onNavigate={onNavigate} />
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* REQUISITO 2.A: HEADER */}
      {/* Top Bar Contract: 3 zones separated by gap-8 (Brand Wordmark, Nav items, 1 Primary Action) */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#081322]/75 shadow-[0_12px_50px_-28px_rgba(0,0,0,.9)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-3 px-4 pl-16 sm:px-6 sm:pl-16 lg:px-8 lg:pl-8">
          {/* Zone 1: Brand Wordmark & Section */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e5c66d]/40 bg-gradient-to-br from-[#f3d77f]/20 via-[#18263a] to-[#091321] shadow-[0_0_28px_rgba(212,175,55,.16)]">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-extrabold tracking-[0.04em] text-white whitespace-nowrap">
                Diamante OS
              </span>
              <span className="text-xs text-gray-400 font-medium">/</span>
              <span className="text-[10px] font-bold text-[#e7c76b] uppercase tracking-[0.22em] whitespace-nowrap">
                Painel Central
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links to Admin Modules & Quick Stats */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            <button
              onClick={() => onNavigate('/admin/lojas')}
              className="px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-[#D4AF37]/20 border border-gray-700/80 hover:border-[#D4AF37]/40 text-gray-200 hover:text-[#D4AF37] transition-all flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Lojas ({lojas.length})</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/funcionarios')}
              className="px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-[#D4AF37]/20 border border-gray-700/80 hover:border-[#D4AF37]/40 text-gray-200 hover:text-[#D4AF37] transition-all flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Funcionárias</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/config')}
              className="px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-[#D4AF37]/20 border border-gray-700/80 hover:border-[#D4AF37]/40 text-gray-200 hover:text-[#D4AF37] transition-all flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Configurações</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-gray-800 text-gray-400 font-mono text-[11px]">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{globalKpis.pendentesHoje} Pendentes</span>
            </div>
          </div>

          {/* Zone 3: Perfil Admin & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => fetchWarRoomData()}
              disabled={isRefreshing}
              title="Sincronizar dados"
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
            </button>

            {/* Admin Profile Pill */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-800">
              <div className="w-8 h-8 rounded-lg bg-gray-800 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white leading-tight">
                  {userSession?.nome_completo || 'Administrador'}
                </p>
                <p className="text-[10px] font-mono text-gray-400 leading-tight">
                  {userSession?.email || 'admin@diamante.pt'}
                </p>
              </div>
            </div>

            {/* Logout button (Hitbox >= 40px) */}
            <button
              onClick={handleLogout}
              title="Terminar Sessão"
              className="p-2 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 space-y-8 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <section aria-label="Centro de comando Diamante" className="relative isolate overflow-hidden rounded-[28px] border border-[#d8b85d]/20 bg-[linear-gradient(112deg,rgba(18,34,55,.98),rgba(10,20,36,.96)_55%,rgba(35,29,18,.86))] p-5 shadow-[0_28px_90px_-48px_rgba(0,0,0,.95)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_45%,rgba(212,175,55,.16),transparent_34%),linear-gradient(120deg,transparent_30%,rgba(255,255,255,.035),transparent_72%)]" />
          <div className="pointer-events-none absolute -right-10 -top-28 h-80 w-80 rounded-full border border-[#e4c76f]/10" />
          <div className="orbit-spin pointer-events-none absolute -right-2 top-[-5.5rem] hidden h-[23rem] w-[23rem] rounded-full border border-dashed border-[#e4c76f]/20 lg:block" />
          <div className="pointer-events-none absolute right-16 top-12 hidden h-56 w-56 rounded-full border border-[#e4c76f]/15 shadow-[inset_0_0_55px_rgba(212,175,55,.08),0_0_65px_rgba(212,175,55,.08)] lg:block" />
          <div className="pointer-events-none absolute right-[7.7rem] top-[7.7rem] hidden h-24 w-24 rounded-full bg-gradient-to-br from-[#f4dc8c]/25 to-cyan-300/5 blur-xl lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_330px] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                <span className={`signal-pulse h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {isOnline ? 'Sistema operacional · sincronização activa' : 'Ligação indisponível · a aguardar sincronização'}
              </div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.32em] text-[#e4c76f]">DIAMANTE D’OURO / INTELLIGENCE</p>
              <h1 className="max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-4xl lg:text-[3.35rem]">Centro de <span className="bg-gradient-to-r from-[#f7e6a9] via-[#d8b85d] to-[#a98432] bg-clip-text text-transparent">comando</span></h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300/80 sm:text-[15px]">Visão global da operação, actividade da rede e controlo administrativo num único espaço inteligente.</p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <button onClick={() => onNavigate('/admin/transacoes')} className="group inline-flex items-center gap-2 rounded-xl border border-[#e7ca78]/40 bg-gradient-to-r from-[#d4af37] to-[#a9822d] px-4 py-3 text-xs font-extrabold text-[#101827] shadow-[0_10px_28px_-12px_rgba(212,175,55,.65)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_35px_-12px_rgba(212,175,55,.65)]"><ReceiptText className="h-4 w-4" /> Explorar transacções <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
                <button onClick={() => onNavigate('/stores')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-xs font-semibold text-slate-200 transition-all hover:border-white/20 hover:bg-white/[0.08]"><Building2 className="h-4 w-4 text-[#e4c76f]" /> Gestão da rede</button>
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-3 lg:max-w-[330px]">
              <div className="rounded-2xl border border-white/10 bg-[#071321]/55 p-4 backdrop-blur-xl"><div className="mb-3 flex items-center justify-between"><Radio className="h-4 w-4 text-emerald-300" /><span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Estado</span></div><p className="text-lg font-semibold text-white">{isOnline ? 'Online' : 'Offline'}</p><p className="mt-1 text-[10px] text-slate-400">API administrativa</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#071321]/55 p-4 backdrop-blur-xl"><div className="mb-3 flex items-center justify-between"><Building2 className="h-4 w-4 text-[#e4c76f]" /><span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Rede</span></div><p className="text-lg font-semibold text-white tabular-nums">{globalKpis.totalLojas}</p><p className="mt-1 text-[10px] text-slate-400">Lojas registadas</p></div>
              <div className="col-span-2 flex items-center justify-between rounded-2xl border border-[#d8b85d]/15 bg-gradient-to-r from-[#d8b85d]/[0.09] to-transparent px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d8b85d]/20 bg-[#d8b85d]/10"><ShieldCheck className="h-4 w-4 text-[#e7ca78]" /></div><div><p className="text-xs font-semibold text-slate-100">Ambiente protegido</p><p className="mt-0.5 text-[10px] text-slate-400">Acesso administrativo autenticado</p></div></div><Zap className="h-4 w-4 text-[#d8b85d]" /></div>
            </div>
          </div>
          <div className="scan-line pointer-events-none absolute left-0 right-0 top-0 h-20 bg-gradient-to-b from-transparent via-white/[0.025] to-transparent" />
        </section>
        {/* Estados explícitos da API administrativa */}
        {dataError && (
          <div role="alert" className="p-4 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-200 text-xs">
            <strong className="block mb-1">Não foi possível carregar a Sala de Guerra</strong>
            <span>{dataError}</span>
          </div>
        )}
        {!isLoading && isOnline && lojas.length === 0 && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Não existem lojas registadas para apresentar.</span>
            </div>
            <span className="text-[11px] text-amber-300/80">
              Estado vazio · Nenhum dado fictício gerado
            </span>
          </div>
        )}

        {/* REQUISITO 2.B: KPIS GLOBAIS (Grid 4 cols) */}
        <section aria-label="KPIs Globais da Rede" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d8b85d]">Inteligência operacional</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Indicadores da rede</h2></div><div className="flex items-center gap-2 text-[10px] font-medium text-slate-500"><Activity className="h-3.5 w-3.5 text-[#d8b85d]" /> Actualização automática · 30 segundos</div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {/* 1. Volume Hoje */}
            <KPICard
              title="Volume Compras Hoje"
              value={formatCurrency(globalKpis.volumeHoje)}
              icon={Coins}
              highlight={true}
              isLoading={isLoading}
              delta={{
                value: volumeDelta,
                label: 'vs ontem',
                isPositiveGood: true,
              }}
              onClick={() => onNavigate('/admin/transacoes')}
              subtitle={
                globalKpis.volumeOntem > 0
                  ? `Ontem: ${formatCurrency(globalKpis.volumeOntem)}`
                  : 'Primeiro registo do dia'
              }
            />

            {/* 2. Pendentes Aprovação */}
            <KPICard
              title="Pendentes Aprovação"
              value={globalKpis.pendentesHoje}
              icon={ClockAlert}
              isLoading={isLoading}
              delta={
                globalKpis.pendentesOntem > 0
                  ? {
                      value: pendentesDelta,
                      label: 'vs ontem',
                      isPositiveGood: false,
                    }
                  : undefined
              }
              onClick={() => onNavigate('/admin/transacoes-pendentes')}
              subtitle="A aguardar transferência bancária · Abrir lista"
            />

            <KPICard
              title="Total de transações"
              value={totalTransactions}
              icon={ReceiptText}
              isLoading={isLoading}
              onClick={() => onNavigate('/admin/transacoes')}
              subtitle="Todos os registos · Abrir lista"
            />
            {/* 3. Peso Rede (Hoje) */}
            <KPICard
              title="Peso Total da Rede"
              value={
                globalKpis.pesoHoje > 0
                  ? `${globalKpis.pesoHoje.toFixed(1)} g`
                  : '0.0 g'
              }
              icon={Scale}
              isLoading={isLoading}
              onClick={() => onNavigate('/admin/transacoes')}
              subtitle="Ouro comprado hoje · Ver transações"
            />

            {/* 4. Lojas Ativas */}
            <KPICard
              title="Lojas Conectadas"
              value={`${globalKpis.lojasAtivas} / ${globalKpis.totalLojas}`}
              icon={Building2}
              isLoading={isLoading}
              onClick={() => onNavigate('/stores')}
              subtitle="Lojas em operação · Abrir gestão"
            />
          </div>
        </section>

        {/* REQUISITO 2.C & 2.D: SALA DE GUERRA (HEAT MAP + REALTIME FEED) */}
        <section aria-label="Sala de Guerra Operacional" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d8b85d]">Monitorização em directo</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Radar operacional</h2></div><span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} /> {isOnline ? 'Feed ligado' : 'Feed sem ligação'}</span></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* MAPA CALOR LOJAS (7 Cols) */}
            <div className="lg:col-span-7">
              <StoreHeatMap
                lojas={lojas}
                isLoading={isLoading}
                onSelectLoja={handleOpenLojaDetails}
              />
            </div>

            {/* FEED REALTIME TRANSAÇÕES (5 Cols) */}
            <div className="lg:col-span-5">
              <LiveFeed
                lojasMap={lojasMap}
                transacoes={recentTxs}
                isLoading={isLoading}
                errorMessage={dataError}
                onRefresh={fetchWarRoomData}
                onSelectTransaction={(tx) => {
                  const loja = lojas.find((l) => l.id === tx.loja_id);
                  if (loja) handleOpenLojaDetails(loja);
                }}
              />
            </div>
          </div>
        </section>

        {/* REQUISITO 2.E: TABELA GESTÃO LOJAS */}
        <section aria-label="Tabela de Gestão de Lojas" className="space-y-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d8b85d]">Controlo da rede</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Lojas e desempenho</h2></div>
          <StoreTable
            lojas={lojas}
            isLoading={isLoading}
            onSelectLoja={handleOpenLojaDetails}
          />
        </section>
      </main>

      {/* Drawer: Store Details */}
      <StoreDetailDrawer
        loja={selectedLoja}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefreshData={fetchWarRoomData}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-white/[0.07] bg-[#081322]/65 py-5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-300">Diamante OS v2</span>
            <span>·</span>
            <span>Gestão de compra de ouro sem vendas</span>
            <span>·</span>
            <span>Pagamento exclusivamente por transferência</span>
          </div>
          <div className="font-mono text-[11px] text-gray-400">
            API administrativa protegida · Autenticação JWT
          </div>
        </div>
      </footer>
    </div>
  );
};
