// PATH: src/components/admin/LogAuditPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AdminSidebar } from './AdminSidebar';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Building2,
  Clock,
  User,
  Key,
  Coins,
  CreditCard,
  SlidersHorizontal,
  Smartphone,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lock,
  Unlock,
  FileText,
  Copy,
  Check,
  X,
  ArrowUpDown,
  Terminal,
  Activity,
  Layers,
  ChevronRight,
  Printer,
  Hash,
  Globe,
  TrendingUp,
} from 'lucide-react';

export type LogSeverity = 'critical' | 'security' | 'warning' | 'info' | 'success';

export type LogCategory =
  | 'auth'
  | 'transaction'
  | 'store'
  | 'employee'
  | 'pricing'
  | 'finance'
  | 'security';

export interface AuditLogItem {
  id: string;
  timestamp: string; // ISO ou formatado DD/MM/AAAA HH:mm:ss
  severity: LogSeverity;
  category: LogCategory;
  action: string;
  description: string;
  actorNome: string;
  actorRole: string;
  actorPhone: string;
  lojaNome: string;
  lojaId?: string;
  ipAddress: string;
  userAgent: string;
  hashIntegridade: string;
  metadados?: Record<string, any>;
  diff?: {
    campo: string;
    anterior: string | number;
    novo: string | number;
  }[];
}

interface LogAuditPageProps {
  onNavigate?: (path: string) => void;
}

export const LogAuditPage: React.FC<LogAuditPageProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | LogSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | LogCategory>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '24h' | '7d'>('all');

  // Modal de Inspeção Forense do Log
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Os registos apresentados vêm exclusivamente da tabela de auditoria.
  const fetchLogsFromDatabase = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setLogs([]);
        setLastSyncTime('');
        return;
      }

      const { data: dbLogs, error } = await supabase
        .from('logs_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formatted: AuditLogItem[] = (dbLogs || []).map((item: any) => ({
        id: String(item.id || ''),
        timestamp: item.created_at || '',
        severity: (['critical', 'security', 'warning', 'info', 'success'].includes(item.severity) ? item.severity : 'info') as LogSeverity,
        category: (['auth', 'transaction', 'store', 'employee', 'pricing', 'finance', 'security'].includes(item.category) ? item.category : 'transaction') as LogCategory,
        action: item.action || '',
        description: item.description || item.detalhes || '',
        actorNome: item.actor_nome || item.user_name || '',
        actorRole: item.actor_role || '',
        actorPhone: item.actor_phone || '',
        lojaNome: item.loja_nome || '',
        lojaId: item.loja_id || undefined,
        ipAddress: item.ip_address || '',
        userAgent: item.user_agent || '',
        hashIntegridade: item.hash || '',
        metadados: item.metadata || {},
      }));

      setLogs(formatted);
      setLastSyncTime(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setLogs([]);
      setLastSyncTime('');
      console.warn('[LogAudit] Falha ao consultar registos de auditoria.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogsFromDatabase();
  }, [fetchLogsFromDatabase]);

  // =========================================================
  // 1. ESTATÍSTICAS DO PAINEL FORENSE
  // =========================================================
  const { totalCount, criticalCount, securityCount, transactionCount, configCount } =
    useMemo(() => {
      let crit = 0;
      let sec = 0;
      let tx = 0;
      let cfg = 0;

      logs.forEach((log) => {
        if (log.severity === 'critical') crit++;
        if (log.category === 'security' || log.severity === 'security') sec++;
        if (log.category === 'transaction') tx++;
        if (log.category === 'pricing' || log.category === 'store' || log.category === 'employee')
          cfg++;
      });

      return {
        totalCount: logs.length,
        criticalCount: crit,
        securityCount: sec,
        transactionCount: tx,
        configCount: cfg,
      };
    }, [logs]);

  // =========================================================
  // 2. FILTRAGEM MULTICRITÉRIO DOS LOGS
  // =========================================================
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Severidade
      if (severityFilter !== 'all' && log.severity !== severityFilter) {
        return false;
      }

      // Categoria
      if (categoryFilter !== 'all' && log.category !== categoryFilter) {
        return false;
      }

      // Loja
      if (storeFilter !== 'all' && log.lojaNome !== storeFilter) {
        return false;
      }

      // Período
      if (periodFilter === 'today' && new Date(log.timestamp).toDateString() !== new Date().toDateString()) {
        return false;
      }
      if (periodFilter === '24h' && Date.now() - new Date(log.timestamp).getTime() > 24 * 60 * 60 * 1000) {
        return false;
      }

      // Pesquisa por Texto Livre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = log.id.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchActor = log.actorNome.toLowerCase().includes(q);
        const matchLoja = log.lojaNome.toLowerCase().includes(q);
        const matchIp = log.ipAddress.toLowerCase().includes(q);
        const matchHash = log.hashIntegridade.toLowerCase().includes(q);

        if (!matchId && !matchAction && !matchDesc && !matchActor && !matchLoja && !matchIp && !matchHash) {
          return false;
        }
      }

      return true;
    });
  }, [logs, severityFilter, categoryFilter, storeFilter, periodFilter, searchQuery]);

  // Exportação CSV do histórico de logs
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Data/Hora',
      'Severidade',
      'Categoria',
      'Acao',
      'Descricao',
      'Utilizador',
      'Cargo',
      'Telemovel',
      'Loja',
      'IP',
      'HashIntegridade',
    ];

    const rows = filteredLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.severity}"`,
      `"${log.category}"`,
      `"${log.action.replace(/"/g, '""')}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      `"${log.actorNome}"`,
      `"${log.actorRole}"`,
      `"${log.actorPhone}"`,
      `"${log.lojaNome}"`,
      `"${log.ipAddress}"`,
      `"${log.hashIntegridade}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `diamante_os_auditoria_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper de Badge de Severidade
  const renderSeverityBadge = (severity: LogSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs shadow-rose-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            Crítico
          </span>
        );
      case 'security':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3 text-purple-400" />
            Segurança
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Aviso
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Info className="w-3 h-3 text-blue-400" />
            Info
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Sucesso
          </span>
        );
    }
  };

  // Helper de Ícone de Categoria
  const renderCategoryIcon = (category: LogCategory) => {
    switch (category) {
      case 'auth':
        return <Key className="w-3.5 h-3.5 text-blue-400" />;
      case 'transaction':
        return <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />;
      case 'store':
        return <Building2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'employee':
        return <User className="w-3.5 h-3.5 text-purple-400" />;
      case 'pricing':
        return <TrendingUp className="w-3.5 h-3.5 text-amber-400" />;
      case 'finance':
        return <CreditCard className="w-3.5 h-3.5 text-cyan-400" />;
      case 'security':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Sidebar Administrativo Integrado */}
      {onNavigate && <AdminSidebar currentPath="/admin/logs" onNavigate={onNavigate} />}

      <div className={`flex-1 transition-all duration-300 ${onNavigate ? 'lg:pl-64' : ''}`}>
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* =========================================================
              1. HEADER COM STATUS EM TEMPO REAL E EXPORTAÇÃO
             ========================================================= */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                  <Terminal className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      Registo de Auditoria & Segurança
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      SHA-256 Imutável
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Trilha forense completa de transações, acessos OTP, alterações de preço e alertas de segurança
                  </p>
                </div>
              </div>
            </div>

            {/* Ações Rápidas do Cabeçalho */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
              <span className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 text-slate-400">
                Registos da base de dados
              </span>

              {/* Botão Sincronizar */}
              <button
                onClick={fetchLogsFromDatabase}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="Sincronizar com a base de dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              {/* Botão Exportar CSV */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </header>

          {/* =========================================================
              2. STATS CARDS DE SEGURANÇA E AUDITORIA
             ========================================================= */}
          <section
            aria-label="Indicadores Forenses"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Total de Eventos */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Total de Registos
                </span>
                <p className="text-2xl font-extrabold text-white font-mono">
                  {totalCount}
                </p>
                <p className="text-[10px] text-slate-400">
                  Sincronizado: <span className="font-mono text-slate-300">{lastSyncTime || '—'}</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#D4AF37]">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {/* Alertas Críticos */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Alertas Críticos
                </span>
                <p className="text-2xl font-extrabold text-rose-400 font-mono">
                  {criticalCount}
                </p>
                <p className="text-[10px] text-rose-400/80 font-medium">
                  Fraudes e divergências legais
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            {/* Transações & Liquidações */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Eventos de Ouro & SEPA
                </span>
                <p className="text-2xl font-extrabold text-amber-300 font-mono">
                  {transactionCount}
                </p>
                <p className="text-[10px] text-amber-400/80 font-medium">
                  Avaliações e pagamentos bancários
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Alterações Administrativas */}
            <div className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Definições & Sistema
                </span>
                <p className="text-2xl font-extrabold text-purple-300 font-mono">
                  {configCount}
                </p>
                <p className="text-[10px] text-purple-400/80 font-medium">
                  Ajustes de preço e pessoal
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
            </div>
          </section>

          {/* =========================================================
              3. BARRA DE PESQUISA & FILTROS AVANÇADOS
             ========================================================= */}
          <section
            aria-label="Filtros de Auditoria"
            className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
          >
            {/* Linha 1: Pesquisa Geral + Dropdown de Balcão */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:max-w-lg">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por ID, ação, utilizador, telemóvel, balcão, IP ou hash..."
                  className="w-full pl-10 pr-9 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Limpar pesquisa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro por Balcão */}
              <div className="w-full md:w-80 shrink-0">
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="all">Todos os Balcões & Sede Central</option>
                  {[...new Set(logs.map((log) => log.lojaNome).filter(Boolean))].map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Filtros Pill por Severidade & Categoria */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
              {/* Severidade */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                  Severidade:
                </span>
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'critical', label: 'Crítico' },
                    { id: 'security', label: 'Segurança' },
                    { id: 'warning', label: 'Aviso' },
                    { id: 'success', label: 'Sucesso' },
                    { id: 'info', label: 'Info' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeverityFilter(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      severityFilter === s.id
                        ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                        : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Período */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                  Período:
                </span>
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'today', label: 'Hoje' },
                    { id: '24h', label: 'Últimas 24h' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodFilter(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      periodFilter === p.id
                        ? 'bg-slate-700 text-white font-bold'
                        : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* =========================================================
              4. LISTA / TABELA DE LOGS DE AUDITORIA
             ========================================================= */}
          <section aria-label="Stream de Auditoria">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
                <Terminal className="w-12 h-12 text-slate-500 mx-auto stroke-1" />
                <p className="text-base font-bold text-white">Nenhum evento forense encontrado</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Não foram detetados registos de auditoria correspondentes aos critérios de pesquisa selecionados.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSeverityFilter('all');
                    setCategoryFilter('all');
                    setStoreFilter('all');
                    setPeriodFilter('all');
                  }}
                  className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
                >
                  Repor todos os filtros
                </button>
              </div>
            ) : (
              <>
                {/* DESKTOP VIEW: Tabela Forense Densa (Visível em md+) */}
                <div className="hidden md:block rounded-2xl bg-[#151b2b] border border-slate-800/90 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0b0f19] text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4">Ref. / Data e Hora</th>
                          <th className="py-3.5 px-4">Severidade</th>
                          <th className="py-3.5 px-4">Módulo / Ação</th>
                          <th className="py-3.5 px-4">Descrição do Evento</th>
                          <th className="py-3.5 px-4">Utilizador / Balcão</th>
                          <th className="py-3.5 px-4">IP Origem</th>
                          <th className="py-3.5 px-4 text-right">Forense</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {filteredLogs.map((log) => (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          >
                            {/* Ref e Data */}
                            <td className="py-3.5 px-4 font-mono">
                              <span className="font-bold text-[#D4AF37] group-hover:underline block text-[11px]">
                                {log.id}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {log.timestamp}
                              </span>
                            </td>

                            {/* Severidade */}
                            <td className="py-3.5 px-4">
                              {renderSeverityBadge(log.severity)}
                            </td>

                            {/* Módulo & Ação */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-[#0b0f19] border border-slate-800 shrink-0">
                                  {renderCategoryIcon(log.category)}
                                </div>
                                <span className="font-semibold text-white truncate max-w-[170px]">
                                  {log.action}
                                </span>
                              </div>
                            </td>

                            {/* Descrição */}
                            <td className="py-3.5 px-4">
                              <p className="text-slate-300 truncate max-w-[320px] text-xs">
                                {log.description}
                              </p>
                              {log.diff && log.diff.length > 0 && (
                                <span className="text-[10px] font-mono text-amber-300/90 block mt-0.5">
                                  Alteração: {log.diff[0].campo} ({log.diff[0].anterior} &rarr; {log.diff[0].novo})
                                </span>
                              )}
                            </td>

                            {/* Utilizador & Balcão */}
                            <td className="py-3.5 px-4">
                              <p className="font-medium text-white truncate max-w-[160px]">
                                {log.actorNome}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                {log.lojaNome.replace("Diamante D'ouro - ", '')}
                              </p>
                            </td>

                            {/* IP */}
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                              {log.ipAddress}
                            </td>

                            {/* Ações */}
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] border border-slate-700 transition-colors cursor-pointer"
                                title="Inspecionar detalhes forenses do evento"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MOBILE VIEW: Cards Forenses (<md) */}
                <div className="md:hidden space-y-3">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-2.5 active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#D4AF37]">
                          {log.id}
                        </span>
                        {renderSeverityBadge(log.severity)}
                      </div>

                      <div>
                        <h2 className="font-bold text-sm text-white flex items-center gap-1.5">
                          {renderCategoryIcon(log.category)}
                          <span className="truncate">{log.action}</span>
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                          {log.description}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>Operador:</span>
                          <strong className="text-white font-medium">{log.actorNome}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Balcão:</span>
                          <span className="text-slate-300 truncate max-w-[180px]">
                            {log.lojaNome.replace("Diamante D'ouro - ", '')}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800 font-mono">
                          <span>Timestamp:</span>
                          <span className="text-slate-300">{log.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* =========================================================
              5. MODAL FORENSE DE INSPEÇÃO DE LOG
             ========================================================= */}
          {selectedLog && (
            <div
              className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
              onClick={() => setSelectedLog(null)}
            >
              <div
                className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative my-8"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header do Modal */}
                <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                        {selectedLog.id}
                      </span>
                      {renderSeverityBadge(selectedLog.severity)}
                      <span className="text-[11px] font-mono text-slate-400">
                        {selectedLog.timestamp}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-2">
                      {selectedLog.action}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conteúdo Forense */}
                <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto">
                  {/* Descrição Detalhada */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      Resumo do Evento Registado
                    </span>
                    <p className="text-sm text-white leading-relaxed">
                      {selectedLog.description}
                    </p>
                  </div>

                  {/* Detalhes de Utilizador & Localização */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Agente / Utilizador
                      </span>
                      <p className="font-bold text-white text-xs">{selectedLog.actorNome}</p>
                      <p className="text-[11px] text-slate-400">
                        Cargo: <span className="text-slate-200">{selectedLog.actorRole}</span>
                      </p>
                      {selectedLog.actorPhone && selectedLog.actorPhone !== 'N/A' && (
                        <p className="text-[11px] font-mono text-[#D4AF37]">
                          Telemóvel: {selectedLog.actorPhone}
                        </p>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Origem & Balcão
                      </span>
                      <p className="font-bold text-white text-xs">{selectedLog.lojaNome}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        IP: <span className="text-slate-200">{selectedLog.ipAddress}</span>
                      </p>
                    </div>
                  </div>

                  {/* Hash de Integridade Criptográfica (SHA-256) */}
                  <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Assinatura de Integridade Forense (SHA-256)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedLog.hashIntegridade);
                          setCopiedHash(true);
                          setTimeout(() => setCopiedHash(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[#D4AF37] hover:underline cursor-pointer"
                      >
                        {copiedHash ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar Hash</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-slate-300 break-all bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 select-all">
                      {selectedLog.hashIntegridade}
                    </p>
                  </div>

                  {/* Diferenças de Estado (Diff) */}
                  {selectedLog.diff && selectedLog.diff.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase text-amber-300 tracking-wider">
                        Modificação de Dados (Audit Diff)
                      </span>
                      <div className="space-y-1.5">
                        {selectedLog.diff.map((d, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono"
                          >
                            <span className="text-slate-400">{d.campo}:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-rose-400 line-through">{d.anterior}</span>
                              <span className="text-slate-500">&rarr;</span>
                              <span className="text-emerald-400 font-bold">{d.novo}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payload JSON de Metadados */}
                  {selectedLog.metadados && Object.keys(selectedLog.metadados).length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Payload Estruturado (Metadata JSON)
                      </span>
                      <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                        {JSON.stringify(selectedLog.metadados, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Rodapé do Modal */}
                <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Imprimir Certidão Forense</span>
                  </button>

                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default LogAuditPage;
