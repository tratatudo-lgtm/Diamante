// PATH: src/components/settings/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useSystemSettings } from '../../hooks/useSupabaseData';
import {
  SlidersHorizontal,
  Building,
  Coins,
  CreditCard,
  UserCheck,
  Bell,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Lock,
  Key,
  RefreshCw,
  ExternalLink,
  Upload,
  Info,
  Check,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export type SettingsTab =
  | 'geral'
  | 'ouro'
  | 'bancos'
  | 'aprovadores'
  | 'notificacoes'
  | 'seguranca';

export interface BankAccount {
  id: string;
  bancoNome: string;
  titular: string;
  iban: string;
  tipo: 'Principal' | 'Secundária' | 'Emergência';
  ativo: boolean;
  saldoContabilistico: number;
}

export interface Approver {
  id: string;
  nome: string;
  telemovel: string;
  cargo: string;
  limiteAprovacaoEUR: number;
  ativo: boolean;
}

export interface SettingsPageProps {
  onNavigate?: (path: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('geral');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: dbSettings, loading: isLoadingSettings, error: settingsError, saveSettings } = useSystemSettings();

  // =========================================================
  // 1. ESTADO: GERAL
  // =========================================================
  const [generalConfig, setGeneralConfig] = useState({ nomeEmpresa: '', nif: '', moradaSede: '', codigoPostal: '', cidade: '', telefoneSede: '', emailGeral: '', registoContrastaria: '', moedaPadrao: '', fusoHorario: '', logoUrl: '' });

  // =========================================================
  // 2. ESTADO: PREÇO DO OURO & COTAÇÕES
  // =========================================================
  const [goldPrices, setGoldPrices] = useState({ ouro24k: 0, ouro19k: 0, ouro18k: 0, ouro14k: 0, ouro9k: 0, prata925: 0, margemSegurancaPercent: 0, autoUpdate: false, intervaloMinutos: 0, ultimaAtualizacao: '' });

  // =========================================================
  // 3. ESTADO: BANCOS & PAGAMENTOS
  // =========================================================
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [emergencyIban, setEmergencyIban] = useState('');
  const [limiteDiarioSemDuplaAutorizacao, setLimiteDiarioSemDuplaAutorizacao] = useState(0);
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [newBank, setNewBank] = useState({ bancoNome: '', titular: '', iban: '', tipo: 'Secundária' as BankAccount['tipo'] });

  // =========================================================
  // 4. ESTADO: APROVADORES & WHATSAPP OTP
  // =========================================================
  const [approvers, setApprovers] = useState<Approver[]>([]);

  const [duplaAutorizacaoThreshold, setDuplaAutorizacaoThreshold] = useState(0);
  const [isAddApproverModalOpen, setIsAddApproverModalOpen] = useState(false);
  const [newApprover, setNewApprover] = useState({ nome: '', telemovel: '', cargo: '', limiteAprovacaoEUR: 0 });

  // =========================================================
  // 5. ESTADO: NOTIFICAÇÕES
  // =========================================================
  const [notifications, setNotifications] = useState({ whatsappEnabled: false, whatsappInstance: '', whatsappApiUrl: '', notifyNewPurchase: false, notifyOtpSent: false, notifyHighValueTransactions: false, highValueThresholdEUR: 0, emailDailyReport: false, emailAuditAlerts: false, emailDestinatario: '', pushBrowserAlerts: false, alertaLimiteLojaGrama: 0, alertaBlacklistMatch: false });

  // =========================================================
  // 6. ESTADO: SEGURANÇA & ACESSOS
  // =========================================================
  const [security, setSecurity] = useState({ twoFactorEnforced: false, twoFactorMethod: '', sessionTimeoutMinutes: 0, ipAllowlistOnly: false, evolutionApiKey: '', webhookSecret: '', logsAuditRetentionDays: 0 });

  // Sincronização quando as configurações do Supabase são carregadas
  useEffect(() => {
    if (dbSettings) {
      if (dbSettings.general) setGeneralConfig((prev) => ({ ...prev, ...dbSettings.general }));
      if (dbSettings.goldPrices) setGoldPrices((prev) => ({ ...prev, ...dbSettings.goldPrices }));
    }
  }, [dbSettings]);

  // Helper de Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSaveSettings = async () => {
    if (activeTab !== 'geral' && activeTab !== 'ouro') {
      triggerToast('Esta secção ainda não está ligada à persistência. Nenhuma alteração foi guardada.');
      return;
    }
    setIsSaving(true);
    try {
      await saveSettings({
        general: generalConfig,
        goldPrices: goldPrices,
      });
      triggerToast('Configurações guardadas com sucesso na base de dados Supabase.');
    } catch (err: any) {
      triggerToast(err?.message || 'Falha ao guardar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bancoNome.trim() || !newBank.iban.trim()) return;

    triggerToast('A gestão de contas bancárias ainda não está ligada à base de dados. Nenhuma alteração foi guardada.');
    setIsAddBankModalOpen(false);
  };

  const handleRemoveBank = (_id: string) => {
    triggerToast('A gestão de contas bancárias ainda não está ligada à base de dados. Nenhuma alteração foi guardada.');
  };

  const handleAddApprover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApprover.nome.trim() || !newApprover.telemovel.trim()) return;

    triggerToast('A gestão de aprovadores ainda não está ligada à base de dados. Nenhuma alteração foi guardada.');
    setIsAddApproverModalOpen(false);
  };

  const handleRemoveApprover = (_id: string) => {
    triggerToast('A gestão de aprovadores ainda não está ligada à base de dados. Nenhuma alteração foi guardada.');
  };

  const tabs = [
    { id: 'geral', label: 'Geral & Empresa', icon: Building },
    { id: 'ouro', label: 'Preço do Ouro', icon: Coins },
    { id: 'bancos', label: 'Bancos & Pagamentos', icon: CreditCard },
    { id: 'aprovadores', label: 'Aprovadores & OTP', icon: UserCheck },
    { id: 'notificacoes', label: 'Notificações & Alertas', icon: Bell },
    { id: 'seguranca', label: 'Segurança & API', icon: ShieldCheck },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {settingsError && <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{settingsError}</div>}
      {/* Toast Notifier */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#151b2b] border border-[#D4AF37] text-white shadow-2xl animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* =========================================================
            1. HEADER
           ========================================================= */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                <SlidersHorizontal className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Configurações
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Gestão centralizada do sistema &bull; Parâmetros de negócio, tesouraria e segurança
                </p>
                {onNavigate && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onNavigate('/dashboard-admin')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] flex items-center gap-1 transition-colors cursor-pointer font-mono"
                    >
                      &larr; Sala de Guerra
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/stores')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Lojas
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/finance')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Tesouraria
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => onNavigate('/clients')}
                      className="text-xs text-slate-400 hover:text-[#D4AF37] transition-colors cursor-pointer font-mono"
                    >
                      Clientes
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>A Guardar...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>Guardar Alterações</span>
              </>
            )}
          </button>
        </header>

        {/* =========================================================
            2. LAYOUT: TABS VERTICAIS / HORIZONTAIS + PAINEL DE CONTEÚDO
           ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Menu Lateral de Tabs */}
          <nav
            aria-label="Secções de Definições"
            className="lg:col-span-1 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#151b2b] text-[#D4AF37] border border-[#D4AF37]/40 shadow-lg shadow-[#D4AF37]/5'
                      : 'text-slate-400 hover:text-white hover:bg-[#151b2b]/50 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#D4AF37]' : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Painel de Conteúdo Principal */}
          <main className="lg:col-span-3 space-y-6">
            {/* =========================================================
                SECÇÃO 1: GERAL & EMPRESA
               ========================================================= */}
            {activeTab === 'geral' && (
              <section className="p-6 rounded-2xl bg-[#151b2b] border border-slate-800 space-y-6 shadow-xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Building className="w-5 h-5 text-[#D4AF37]" />
                      <span>Identificação Geral da Empresa</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dados fiscais e registo contrastaria exibidos em recibos de compra e declarações oficiais
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Nome Legal da Entidade *</label>
                    <input
                      type="text"
                      value={generalConfig.nomeEmpresa}
                      onChange={(e) =>
                        setGeneralConfig({ ...generalConfig, nomeEmpresa: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-medium focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">NIF / Número de Contribuinte *</label>
                    <input
                      type="text"
                      maxLength={9}
                      value={generalConfig.nif}
                      onChange={(e) => setGeneralConfig({ ...generalConfig, nif: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono font-medium focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Morada da Sede Social *</label>
                    <input
                      type="text"
                      value={generalConfig.moradaSede}
                      onChange={(e) =>
                        setGeneralConfig({ ...generalConfig, moradaSede: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Código Postal & Cidade</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={generalConfig.codigoPostal}
                        onChange={(e) =>
                          setGeneralConfig({ ...generalConfig, codigoPostal: e.target.value })
                        }
                        placeholder="1250-146"
                        className="px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <input
                        type="text"
                        value={generalConfig.cidade}
                        onChange={(e) =>
                          setGeneralConfig({ ...generalConfig, cidade: e.target.value })
                        }
                        placeholder="Lisboa"
                        className="px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Telefone Geral da Sede</label>
                    <input
                      type="text"
                      value={generalConfig.telefoneSede}
                      onChange={(e) =>
                        setGeneralConfig({ ...generalConfig, telefoneSede: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Email Institucional</label>
                    <input
                      type="email"
                      value={generalConfig.emailGeral}
                      onChange={(e) =>
                        setGeneralConfig({ ...generalConfig, emailGeral: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">
                      Licença Oficial Contrastaria (INCM) *
                    </label>
                    <input
                      type="text"
                      value={generalConfig.registoContrastaria}
                      onChange={(e) =>
                        setGeneralConfig({
                          ...generalConfig,
                          registoContrastaria: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono text-[11px] focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Upload Logo Placeholder */}
                <div className="pt-4 border-t border-slate-800">
                  <label className="block text-slate-400 mb-2 font-medium text-xs">
                    Logótipo Oficial do Sistema (Recibos e Relatórios)
                  </label>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0b0f19] border border-dashed border-slate-700">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shrink-0">
                      D
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-white">Diamante D'ouro SVG / PNG</p>
                      <p className="text-slate-400 text-[11px]">Recomendado: 400x400px com fundo transparente</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => triggerToast('Seletor de ficheiros simulado.')}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Carregar Novo Logo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSettings}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#D4AF37]/20"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar Definições Gerais</span>
                  </button>
                </div>
              </section>
            )}

            {/* =========================================================
                SECÇÃO 2: PREÇO DO OURO & COTAÇÕES
               ========================================================= */}
            {activeTab === 'ouro' && (
              <section className="p-6 rounded-2xl bg-[#151b2b] border border-slate-800 space-y-6 shadow-xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-[#D4AF37]" />
                      <span>Preço Base do Ouro & Margens Comerciais</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tabelas de compra sem valores configurados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Sem cotações configuradas
                    </span>
                  </div>
                </div>

                {/* Banner de Cotação de Mercado Spot */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/30 to-[#0b0f19] border border-[#D4AF37]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">
                      Spot Gold Londres / LBMA
                    </span>
                    <p className="text-xl font-mono font-black text-white">
                      €84,50 / grama pura 24k
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Última sincronização: {goldPrices.ultimaAtualizacao}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={goldPrices.autoUpdate}
                        onChange={(e) =>
                          setGoldPrices({ ...goldPrices, autoUpdate: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      <span>Atualização Automática (15m)</span>
                    </label>
                  </div>
                </div>

                {/* Grid de Preço de Compra por Toque */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {/* Ouro 24k */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-700/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Ouro 24k (999‰)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Puro / Barra
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={goldPrices.ouro24k}
                        onChange={(e) =>
                          setGoldPrices({ ...goldPrices, ouro24k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-3 pr-12 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-400">
                        €/g
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Preço pago ao cliente na compra</p>
                  </div>

                  {/* Ouro 19.2k */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#D4AF37]/50 space-y-2 shadow-sm shadow-[#D4AF37]/5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#D4AF37]">Ouro 19.2k (800‰)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold">
                        Padrão Portugal
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={goldPrices.ouro19k}
                        onChange={(e) =>
                          setGoldPrices({ ...goldPrices, ouro19k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-3 pr-12 py-2 bg-[#151b2b] border border-[#D4AF37]/60 rounded-lg text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[#D4AF37]">
                        €/g
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Peças portuguesas e filigranas</p>
                  </div>

                  {/* Ouro 18k */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-700/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Ouro 18k (750‰)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Internacional
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={goldPrices.ouro18k}
                        onChange={(e) =>
                          setGoldPrices({ ...goldPrices, ouro18k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-3 pr-12 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-400">
                        €/g
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Joalharia de marca e importação</p>
                  </div>

                  {/* Ouro 14k */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-700/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Ouro 14k (585‰)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Comum
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={goldPrices.ouro14k}
                        onChange={(e) =>
                          setGoldPrices({ ...goldPrices, ouro14k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-3 pr-12 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-400">
                        €/g
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Peças antigas e ouro dental</p>
                  </div>

                  {/* Ouro 9k */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-700/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Ouro 9k (375‰)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Baixo Toque
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={goldPrices.ouro9k}
                        onChange={(e) =>
                          setGoldPrices({ ...goldPrices, ouro9k: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-3 pr-12 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-400">
                        €/g
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Artefactos modernos leves</p>
                  </div>

                  {/* Prata 925 */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-700/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Prata 925 (Lei)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        Faqueiros & Salvas
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        value={goldPrices.prata925}
                        onChange={(e) =>
                          setGoldPrices({
                            ...goldPrices,
                            prata925: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-3 pr-12 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-hidden focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-400">
                        €/g
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Objetos e moedas em prata</p>
                  </div>
                </div>

                {/* Margem de Segurança */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-white">Margem de Segurança / Spread Operacional</h3>
                    <p className="text-slate-400">
                      Percentagem retida na avaliação para cobertura de volatilidade cambial e despesas de refinação
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={goldPrices.margemSegurancaPercent}
                      onChange={(e) =>
                        setGoldPrices({
                          ...goldPrices,
                          margemSegurancaPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-20 px-3 py-1.5 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono text-center font-bold"
                    />
                    <span className="text-slate-400 font-mono">%</span>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSettings}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#D4AF37]/20"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Atualizar Tabela dos Balcões</span>
                  </button>
                </div>
              </section>
            )}

            {/* =========================================================
                SECÇÃO 3: BANCOS & PAGAMENTOS
               ========================================================= */}
            {activeTab === 'bancos' && (
              <section className="p-6 rounded-2xl bg-[#151b2b] border border-slate-800 space-y-6 shadow-xl animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                      <span>Contas Bancárias & Liquidação Automática</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Contas habilitadas para envio de Transferências Imediatas e SEPA
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddBankModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-[#D4AF37] text-slate-200 hover:text-slate-950 border border-slate-700 hover:border-[#D4AF37] text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Banco</span>
                  </button>
                </div>

                {/* Lista de Contas Bancárias */}
                <div className="space-y-3">
                  {bankAccounts.map((bank) => (
                    <div
                      key={bank.id}
                      className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{bank.bancoNome}</strong>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                              bank.tipo === 'Principal'
                                ? 'bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {bank.tipo}
                          </span>
                          {bank.ativo && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Ativa
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-300 select-all">{bank.iban}</p>
                        <p className="text-[11px] text-slate-400">Titular: {bank.titular}</p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <div className="text-right">
                          <span className="text-[10px] font-mono uppercase text-slate-400 block">
                            Saldo em Conta
                          </span>
                          <strong className="text-sm font-mono text-white">
                            €
                            {new Intl.NumberFormat('pt-PT', {
                              minimumFractionDigits: 2,
                            }).format(bank.saldoContabilistico)}
                          </strong>
                        </div>

                        {bankAccounts.length > 1 && (
                          <button
                            onClick={() => handleRemoveBank(bank.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar conta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* IBAN Livre de Emergência */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-3 text-xs">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-[#D4AF37]" />
                      <span>Conta de Contingência / Liquidação Rápida</span>
                    </h3>
                    <p className="text-slate-400 text-[11px]">
                      IBAN livre para direcionamento manual em caso de indisponibilidade das APIs bancárias principais
                    </p>
                  </div>
                  <input
                    type="text"
                    value={emergencyIban}
                    onChange={(e) => setEmergencyIban(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 bg-[#151b2b] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Limite Diário sem Dupla Autorização */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-white">Limite Diário sem Dupla Autorização</h3>
                    <p className="text-slate-400 text-[11px]">
                      Pagamentos automáticos diários acima deste valor requerem assinatura digital de 2 aprovadores
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">€</span>
                    <input
                      type="number"
                      step="1000"
                      value={limiteDiarioSemDuplaAutorizacao}
                      onChange={(e) =>
                        setLimiteDiarioSemDuplaAutorizacao(parseFloat(e.target.value) || 0)
                      }
                      className="w-28 px-3 py-1.5 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono text-right font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSettings}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#D4AF37]/20"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar Bancos & Pagamentos</span>
                  </button>
                </div>
              </section>
            )}

            {/* =========================================================
                SECÇÃO 4: APROVADORES & WHATSAPP OTP
               ========================================================= */}
            {activeTab === 'aprovadores' && (
              <section className="p-6 rounded-2xl bg-[#151b2b] border border-slate-800 space-y-6 shadow-xl animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-[#D4AF37]" />
                      <span>Aprovadores de Pagamento & Autorizações</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Números de telemóvel habilitados a receber OTPs e autorizar liquidações via WhatsApp
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddApproverModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-[#D4AF37] text-slate-200 hover:text-slate-950 border border-slate-700 hover:border-[#D4AF37] text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Aprovador</span>
                  </button>
                </div>

                {/* Lista de Aprovadores */}
                <div className="space-y-3">
                  {approvers.map((apr) => (
                    <div
                      key={apr.id}
                      className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{apr.nome}</strong>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {apr.cargo}
                          </span>
                          {apr.ativo ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Autorizado
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[#D4AF37]">
                          <Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>{apr.telemovel}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <div className="text-right">
                          <span className="text-[10px] font-mono uppercase text-slate-400 block">
                            Teto por Operação
                          </span>
                          <strong className="text-xs font-mono text-white">
                            €
                            {new Intl.NumberFormat('pt-PT', {
                              minimumFractionDigits: 2,
                            }).format(apr.limiteAprovacaoEUR)}
                          </strong>
                        </div>

                        {approvers.length > 1 && (
                          <button
                            onClick={() => handleRemoveApprover(apr.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remover aprovador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Regra de Dupla Autorização */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-white">Limiar de Dupla Assinatura Obrigatória</h3>
                    <p className="text-slate-400 text-[11px]">
                      Qualquer pagamento unitário superior a este montante exige aprovação de 2 telefones cadastrados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">€</span>
                    <input
                      type="number"
                      step="500"
                      value={duplaAutorizacaoThreshold}
                      onChange={(e) =>
                        setDuplaAutorizacaoThreshold(parseFloat(e.target.value) || 0)
                      }
                      className="w-28 px-3 py-1.5 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono text-right font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSettings}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#D4AF37]/20"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar Aprovadores</span>
                  </button>
                </div>
              </section>
            )}

            {/* =========================================================
                SECÇÃO 5: NOTIFICAÇÕES & ALERTAS
               ========================================================= */}
            {activeTab === 'notificacoes' && (
              <section className="p-6 rounded-2xl bg-[#151b2b] border border-slate-800 space-y-6 shadow-xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Bell className="w-5 h-5 text-[#D4AF37]" />
                      <span>Notificações & Canais de Alerta</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configuração da Evolution API, envio de mensagens e relatórios executivos
                    </p>
                  </div>
                </div>

                {/* Configuração Evolution API */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span>Evolution API (WhatsApp Business Gateway)</span>
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.whatsappEnabled}
                        onChange={(e) =>
                          setNotifications({ ...notifications, whatsappEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Nome da Instância</label>
                      <input
                        type="text"
                        value={notifications.whatsappInstance}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            whatsappInstance: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Endpoint URL da Instância</label>
                      <input
                        type="text"
                        value={notifications.whatsappApiUrl}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            whatsappApiUrl: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Toggles de Notificações */}
                <div className="space-y-3 text-xs">
                  {/* Toggle 1: Alerta de Nova Compra */}
                  <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">Notificar Master a Cada Nova Compra</p>
                      <p className="text-slate-400 text-[11px]">
                        Dispara WhatsApp para o telemóvel da administração assim que uma loja conclui uma liquidação
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.notifyNewPurchase}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            notifyNewPurchase: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]" />
                    </label>
                  </div>

                  {/* Toggle 2: Alerta de Transação de Alto Valor */}
                  <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">
                        Alerta Especial de Transação &gt; €5.000
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Envia SMS prioritário e notificação push imediata
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.notifyHighValueTransactions}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            notifyHighValueTransactions: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]" />
                    </label>
                  </div>

                  {/* Toggle 3: Alerta de Alvo de Ouro em Loja */}
                  <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">
                        Alerta de Acumulação Física de Ouro
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Sinaliza a necessidade de recolha de valores pela transportadora blindada
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.pushBrowserAlerts}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            pushBrowserAlerts: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]" />
                    </label>
                  </div>

                  {/* Toggle 4: Relatório Diário por Email */}
                  <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">Relatório Consolidado Diário por Email</p>
                      <p className="text-slate-400 text-[11px]">
                        A configuração de destinatários e envio de relatórios ainda não está ligada à base de dados.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.emailDailyReport}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            emailDailyReport: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]" />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => triggerToast('As preferências de notificação ainda não estão ligadas à persistência. Nenhuma alteração foi guardada.')}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#D4AF37]/20"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar Preferências de Notificação</span>
                  </button>
                </div>
              </section>
            )}

            {/* =========================================================
                SECÇÃO 6: SEGURANÇA & ACESSOS
               ========================================================= */}
            {activeTab === 'seguranca' && (
              <section className="p-6 rounded-2xl bg-[#151b2b] border border-slate-800 space-y-6 shadow-xl animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                      <span>Segurança, Tokens de API & Auditoria</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Políticas de autenticação, chaves de integração e retenção de registos
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                    Não configurado
                  </span>
                </div>

                {/* 2FA Obligatório */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#D4AF37]" />
                      Autenticação de Dois Fatores (2FA) via WhatsApp / OTP
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      A política de autenticação é gerida no servidor e não pode ser alterada nesta página.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={security.twoFactorEnforced}
                      onChange={(e) =>
                        setSecurity({ ...security, twoFactorEnforced: e.target.checked })
                      }
                      disabled
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>

                {/* Tempo de Expiração da Sessão */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h3 className="font-bold text-white">Tempo de Inatividade para Bloqueio de Ecrã</h3>
                    <p className="text-slate-400 text-[11px]">
                      Termina a sessão de balcão automaticamente caso o operador se ausente
                    </p>
                  </div>
                  <select
                    value={security.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setSecurity({
                        ...security,
                        sessionTimeoutMinutes: parseInt(e.target.value) || 30,
                      })
                    }
                    className="px-3 py-1.5 bg-[#151b2b] border border-slate-700 rounded-lg text-white font-mono cursor-not-allowed opacity-60"
                    disabled
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos (Recomendado)</option>
                    <option value={60}>60 minutos</option>
                    <option value={120}>120 minutos</option>
                  </select>
                </div>

                {/* Gestão de Tokens de API */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-[#D4AF37]" />
                      <span>Chaves de Serviço & Segredos de Integração</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Segredos geridos exclusivamente no servidor; não são expostos no browser.</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[11px] mb-1 font-mono">
                        Evolution API Key (Instância diamante-os):
                      </span>
                      <input
                        type="text"
                        readOnly
                        value="Gerida no servidor — não exposta no browser"
                        className="w-full px-3 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-slate-200 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] mb-1 font-mono">
                        Webhook Verification Signature:
                      </span>
                      <input
                        type="text"
                        readOnly
                        value="Gerida no servidor — não exposta no browser"
                        className="w-full px-3 py-2 bg-[#151b2b] border border-slate-700 rounded-lg text-slate-200 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Logs de Auditoria */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">Retenção de Logs de Auditoria Legal</p>
                    <p className="text-slate-400 text-[11px]">
                      A retenção e integridade dos registos devem ser configuradas no serviço de auditoria.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate('/admin/logs');
                      } else {
                        triggerToast('A redirecionar para o painel de auditoria forense.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Ver Logs de Auditoria</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400 border-t border-slate-800 pt-4">
                  As definições de segurança e os segredos de integração ainda não têm gestão persistente nesta interface.
                </p>
              </section>
            )}
          </main>
        </div>

        {/* =========================================================
            7. MODAL: ADICIONAR BANCO
           ========================================================= */}
        {isAddBankModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsAddBankModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                  <span>Adicionar Conta Bancária da Tesouraria</span>
                </h3>
                <button
                  onClick={() => setIsAddBankModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddBank} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Instituição Bancária *</label>
                  <input
                    type="text"
                    required
                    value={newBank.bancoNome}
                    onChange={(e) => setNewBank({ ...newBank, bancoNome: e.target.value })}
                    placeholder="Ex: Santander Totta / Novo Banco"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Titular da Conta *</label>
                  <input
                    type="text"
                    required
                    value={newBank.titular}
                    onChange={(e) => setNewBank({ ...newBank, titular: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">IBAN Completo (SEPA) *</label>
                  <input
                    type="text"
                    required
                    value={newBank.iban}
                    onChange={(e) =>
                      setNewBank({ ...newBank, iban: e.target.value.toUpperCase() })
                    }
                    placeholder="PT50 0033 0000 1234 5678 9012 3"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono uppercase focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Finalidade da Conta</label>
                  <select
                    value={newBank.tipo}
                    onChange={(e) =>
                      setNewBank({ ...newBank, tipo: e.target.value as BankAccount['tipo'] })
                    }
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                  >
                    <option value="Principal">Principal (Liquidação Imediata)</option>
                    <option value="Secundária">Secundária (Reforço Regional)</option>
                    <option value="Emergência">Emergência / Reserva</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddBankModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Adicionar Conta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            8. MODAL: ADICIONAR APROVADOR
           ========================================================= */}
        {isAddApproverModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsAddApproverModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#D4AF37]" />
                  <span>Cadastrar Aprovador Autorizado</span>
                </h3>
                <button
                  onClick={() => setIsAddApproverModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddApprover} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newApprover.nome}
                    onChange={(e) => setNewApprover({ ...newApprover, nome: e.target.value })}
                    placeholder="Ex: Dr. Miguel Valente"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Telemóvel WhatsApp (+351) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newApprover.telemovel}
                    onChange={(e) => setNewApprover({ ...newApprover, telemovel: e.target.value })}
                    placeholder="+351 912 345 678"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Este número receberá o código OTP para autorizar transferências bancárias
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Cargo / Função</label>
                    <input
                      type="text"
                      value={newApprover.cargo}
                      onChange={(e) => setNewApprover({ ...newApprover, cargo: e.target.value })}
                      placeholder="Diretor Regional"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Teto Máximo (€)</label>
                    <input
                      type="number"
                      step="1000"
                      value={newApprover.limiteAprovacaoEUR}
                      onChange={(e) =>
                        setNewApprover({
                          ...newApprover,
                          limiteAprovacaoEUR: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddApproverModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Autorizar Aprovador
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
