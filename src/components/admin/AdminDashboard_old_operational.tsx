import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Loja, LojaComKpi, Transacao, KpiLojaDiaria, GlobalKpiData } from '../../types/database';
import { KPICard } from '../common/KPICard';
import { LiveFeed } from './LiveFeed';
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
  Users
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

  // Fetch War Room data strictly from real Supabase tables via API or client
  const fetchWarRoomData = useCallback(async () => {
    try {
      setIsRefreshing(true);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStartIso = `${todayStr}T00:00:00.000Z`;

      let rawLojas: Loja[] = [];
      let todayTxs: Transacao[] = [];
      let allPendingTxs: Array<{ id: string; loja_id: string; valor_final: number; peso_gramas: number; estado: string }> = [];
      let kpiToday: KpiLojaDiaria[] = [];
      let kpiYesterday: KpiLojaDiaria[] = [];
      let connected = false;

      // 1. Tentar primeiro através do endpoint server-side /api/admin/war-room (sem restrições de CORS/Iframe)
      try {
        const token = sessionStorage.getItem('diamante_jwt_token');
        if (!token) throw new Error('Sessão administrativa expirada. Volte a iniciar sessão.');
        const res = await fetch('/api/admin/war-room', {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const apiData = await res.json();
          if (apiData && apiData.success) {
            rawLojas = Array.isArray(apiData.lojas) ? apiData.lojas : [];
            todayTxs = Array.isArray(apiData.todayTxs) ? apiData.todayTxs : [];
            allPendingTxs = Array.isArray(apiData.allPendingTxs) ? apiData.allPendingTxs : [];
            kpiToday = Array.isArray(apiData.kpiToday) ? apiData.kpiToday : [];
            kpiYesterday = Array.isArray(apiData.kpiYesterday) ? apiData.kpiYesterday : [];
            connected = Boolean(apiData.isConnected);
          }
        }
      } catch {
        // Fallback silencioso para consulta direta caso o proxy esteja offline
      }

      // 2. Se a API não tiver retornado lojas e o Supabase estiver configurado diretamente no cliente
      if (rawLojas.length === 0 && isSupabaseConfigured()) {
        try {
          const { data: lojasData, error: lojasErr } = await supabase
            .from('lojas')
            .select('*')
            .order('nome', { ascending: true });

          if (!lojasErr && lojasData) {
            rawLojas = lojasData;
            connected = true;

            const { data: txData } = await supabase
              .from('transacoes')
              .select('*')
              .gte('created_at', todayStartIso);
            if (txData) todayTxs = txData;

            const { data: pendingData } = await supabase
              .from('transacoes')
              .select('id, loja_id, valor_final, peso_gramas, estado')
              .eq('estado', 'pendente_aprovacao');
            if (pendingData) allPendingTxs = pendingData as any;

            const { data: kToday } = await supabase
              .from('kpi_loja_diaria')
              .select('*')
              .eq('data', todayStr);
            if (kToday) kpiToday = kToday;

            const { data: kYesterday } = await supabase
              .from('kpi_loja_diaria')
              .select('*')
              .eq('data', yesterdayStr);
            if (kYesterday) kpiYesterday = kYesterday;
          }
        } catch (supabaseErr) {
          console.warn('[Sala de Guerra] Acesso direto Supabase:', supabaseErr);
        }
      }

      // Compute Global KPIs:
      // Volume Hoje: SUM(transacoes.valor_final) WHERE created_at::date = CURRENT_DATE AND estado != 'rascunho'
      const nonDraftTodayTxs = (todayTxs || []).filter((tx) => tx.estado !== 'rascunho');
      const volumeHoje = nonDraftTodayTxs.reduce((sum, tx) => sum + (Number(tx.valor_final) || 0), 0);
      const pesoHoje = nonDraftTodayTxs.reduce((sum, tx) => sum + (Number(tx.peso_gramas) || 0), 0);
      const pendentesHoje = (allPendingTxs || []).length;

      // Yesterday values from kpi_loja_diaria
      const volumeOntem = (kpiYesterday || []).reduce(
        (sum, k) => sum + (Number(k.total_compras_valor) || 0),
        0
      );
      const pendentesOntem = (kpiYesterday || []).reduce(
        (sum, k) => sum + (Number(k.pendentes_aprovacao_qtd) || 0),
        0
      );
      const pesoOntem = 0; // Not tracked in kpi_loja_diaria table schema

      const activeStores = (rawLojas || []).filter((l) => l.ativo !== false).length;

      setGlobalKpis({
        volumeHoje,
        volumeOntem,
        pendentesHoje,
        pendentesOntem,
        pesoHoje,
        pesoOntem,
        lojasAtivas: activeStores,
        totalLojas: rawLojas?.length || 0,
      });

      // Map today's KPIs by loja_id
      const kpiByLoja: Record<string, Partial<KpiLojaDiaria>> = {};
      (kpiToday || []).forEach((k) => {
        kpiByLoja[k.loja_id] = k;
      });

      // Count pending transactions per store
      const pendingsByLoja: Record<string, number> = {};
      (allPendingTxs || []).forEach((tx) => {
        pendingsByLoja[tx.loja_id] = (pendingsByLoja[tx.loja_id] || 0) + 1;
      });

      // Calculate today's volume per store from todayTxs as live fallback if kpi_loja_diaria hasn't run yet
      const liveVolumeByLoja: Record<string, number> = {};
      nonDraftTodayTxs.forEach((tx) => {
        liveVolumeByLoja[tx.loja_id] = (liveVolumeByLoja[tx.loja_id] || 0) + (Number(tx.valor_final) || 0);
      });

      // Build merged LojaComKpi list:
      const mergedLojas: LojaComKpi[] = (rawLojas || []).map((loja) => {
        const kpi = kpiByLoja[loja.id];
        const pendentesCount = pendingsByLoja[loja.id] ?? kpi?.pendentes_aprovacao_qtd ?? 0;
        const totalValor = kpi?.total_compras_valor ?? liveVolumeByLoja[loja.id] ?? 0;

        return {
          ...loja,
          total_compras_valor: totalValor,
          pendentes_aprovacao_qtd: pendentesCount,
          total_compras_qtd: kpi?.total_compras_qtd || 0,
        };
      });

      setLojas(mergedLojas);
      setIsOnline(connected);
    } catch (err: unknown) {
      console.warn('[Sala de Guerra] A aguardar dados do Supabase:', err);
      setIsOnline(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load and periodic heartbeat/realtime listener
  useEffect(() => {
    fetchWarRoomData();

    // Listen to changes in transacoes and kpi_loja_diaria to keep KPIs in sync
    let channel: any = null;
    try {
      if (isSupabaseConfigured()) {
        channel = supabase
          .channel('admin-dashboard-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes' }, () => {
            fetchWarRoomData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_loja_diaria' }, () => {
            fetchWarRoomData();
          })
          .subscribe();
      }
    } catch {
      // Ignorar indisponibilidade de canal realtime em ambiente local/sandbox
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
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
    <div className="min-h-screen bg-[#111827] text-gray-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* REQUISITO 2.A: HEADER */}
      {/* Top Bar Contract: 3 zones separated by gap-8 (Brand Wordmark, Nav items, 1 Primary Action) */}
      <header className="sticky top-0 z-40 bg-[#1F2937]/90 backdrop-blur-md border-b border-gray-800">
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
              title="Sincronizar Dados Supabase"
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
        {/* Banner if stores or transactions are totally empty in real DB */}
        {!isLoading && lojas.length === 0 && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                A base de dados Supabase não possui lojas registadas na tabela <code>lojas</code>.
              </span>
            </div>
            <span className="text-[11px] text-amber-300/80">
              Empty State ativo · Nenhum dado falso gerado
            </span>
          </div>
        )}

        {/* REQUISITO 2.B: KPIS GLOBAIS (Grid 4 cols) */}
        <section aria-label="KPIs Globais da Rede">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              subtitle="A aguardar transferência bancária"
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
              subtitle="Ouro comprado hoje"
            />

            {/* 4. Lojas Ativas */}
            <KPICard
              title="Lojas Conectadas"
              value={`${globalKpis.lojasAtivas} / ${globalKpis.totalLojas}`}
              icon={Building2}
              isLoading={isLoading}
              subtitle="Lojas em operação no sistema"
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
            RLS Enforcement: Ativo · Supabase Client v2
          </div>
        </div>
      </footer>
    </div>
  );
};
