import React, { useEffect, useState, useCallback, useMemo } from 'react';

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
  ReceiptText
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

      const nonDraftTodayTxs = todayTxs.filter((tx) => tx.estado !== 'rascunho');
      const volumeHoje = nonDraftTodayTxs.reduce((sum, tx) => sum + (Number(tx.valor_final) || 0), 0);
      const pesoHoje = nonDraftTodayTxs.reduce((sum, tx) => sum + (Number(tx.peso_gramas) || 0), 0);
      const pendentesHoje = allPendingTxs.length;

      const volumeOntem = kpiYesterday.reduce(
        (sum, k) => sum + (Number(k.total_compras_valor) || 0),
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
        pesoOntem: 0,
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.10),_transparent_42%),#080d18] text-gray-100 flex flex-col lg:pl-64 selection:bg-[#D4AF37]/30 selection:text-white">
      <DiamanteSidebar currentPath="/dashboard-admin" onNavigate={onNavigate} />
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* REQUISITO 2.A: HEADER */}
      {/* Top Bar Contract: 3 zones separated by gap-8 (Brand Wordmark, Nav items, 1 Primary Action) */}
      <header className="sticky top-0 z-40 bg-[#0d1422]/85 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark & Section */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#D4AF37]/50 shadow-sm">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                Diamante OS
              </span>
              <span className="text-xs text-gray-400 font-medium">/</span>
              <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider whitespace-nowrap">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
        <section aria-label="KPIs Globais da Rede">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
              onClick={() => onNavigate('/finance')}
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
              title="Transações recentes"
              value={recentTxs.length}
              icon={ReceiptText}
              isLoading={isLoading}
              onClick={() => onNavigate('/admin/transacoes')}
              subtitle="Últimos 20 registos · Abrir lista"
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
        <section aria-label="Sala de Guerra Operacional">
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
        <section aria-label="Tabela de Gestão de Lojas">
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
      <footer className="border-t border-gray-800 bg-[#1F2937]/50 py-4 mt-auto">
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
