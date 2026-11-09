// PATH: src/components/admin/AdminConfigPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer, ToastMessage } from '../common/Toast';
import type { MargemMetalConfig, TetoAprovacaoConfig, ContaBancariaConfig } from '../../types/admin';
import {
  SlidersHorizontal,
  Coins,
  ShieldAlert,
  CreditCard,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Percent,
  Lock,
  Phone,
  Building2,
  Check,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

interface AdminConfigPageProps {
  onNavigate: (path: string) => void;
}

export const AdminConfigPage: React.FC<AdminConfigPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'margens' | 'tetos' | 'contas'>('margens');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estados de Configuração
  const [margens, setMargens] = useState<MargemMetalConfig[]>([]);
  const [tetos, setTetos] = useState<TetoAprovacaoConfig>({
    id: 'teto-global',
    loja_id: null,
    valor_limite_sem_aprovacao: 1000,
    peso_limite_sem_aprovacao_g: 50.0,
    exigir_dupla_assinatura_acima: 5000,
    notificar_whatsapp_master: true,
    telemovel_alerta: '+351937230116',
    ativo: true,
  });
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaConfig[]>([]);

  // Modal / Formulário Nova Conta Bancária
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<Omit<ContaBancariaConfig, 'id'>>({
    banco: 'Millennium BCP',
    iban: 'PT50 ',
    titular: "Diamante D'ouro Lda",
    descricao: 'Conta de Liquidação Imediata',
    ativo: true,
    padrao: false,
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', message: string, title?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Carregar Configurações (GET /admin/config/margens)
  const fetchConfigs = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const token = sessionStorage.getItem('diamante_jwt_token');
      const res = await fetch('/api/admin/config/margens', {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (Array.isArray(data.margens)) setMargens(data.margens);
          if (data.tetos) setTetos(data.tetos);
          if (Array.isArray(data.contasBancarias)) setContasBancarias(data.contasBancarias);
        }
      }
    } catch (err: any) {
      console.warn('[AdminConfig] Aviso ao carregar configs:', err?.message || err);
      addToast('info', 'A carregar valores padrão de margens do sistema.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Recalcular Preço ao mudar Margem ou Cotação
  const handleMargemChange = (index: number, field: keyof MargemMetalConfig, value: number) => {
    setMargens((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      const cotacao = field === 'cotacao_referencia_g' ? value : item.cotacao_referencia_g;
      const margemPerc = field === 'margem_percentagem' ? value : item.margem_percentagem;
      const toque = item.toque_millesimos || 800;

      // Fórmula: Cotação * (Toque / 1000) * (1 - Margem%)
      const calculatedPrice = Number((cotacao * (toque / 1000) * (1 - margemPerc / 100)).toFixed(2));
      item.preco_compra_grama = calculatedPrice;

      updated[index] = item;
      return updated;
    });
  };

  // Gravar Configurações (PUT /admin/config/margens)
  const handleSaveConfigs = async () => {
    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const res = await fetch('/api/admin/config/margens', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          margens,
          tetos,
          contasBancarias,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Falha ao gravar configurações.');
      }

      addToast('success', 'Margens e parâmetros de negócio gravados com sucesso.', 'Configuração Guardada');
    } catch (err: any) {
      console.warn('[AdminConfig] Erro ao gravar:', err?.message || err);
      addToast('error', err?.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  // Adicionar Conta Bancária
  const handleAddAccount = () => {
    if (!newAccount.iban.trim() || newAccount.iban.replace(/\s/g, '').length < 15) {
      addToast('error', 'Por favor introduza um IBAN português válido.');
      return;
    }

    const created: ContaBancariaConfig = {
      id: `banc-${Date.now()}`,
      ...newAccount,
      iban: newAccount.iban.trim().toUpperCase(),
    };

    setContasBancarias((prev) => {
      if (created.padrao) {
        return [...prev.map((c) => ({ ...c, padrao: false })), created];
      }
      return [...prev, created];
    });

    setIsNewAccountOpen(false);
    setNewAccount({
      banco: 'Millennium BCP',
      iban: 'PT50 ',
      titular: "Diamante D'ouro Lda",
      descricao: 'Conta de Liquidação Imediata',
      ativo: true,
      padrao: false,
    });
    addToast('success', 'Nova conta bancária adicionada à lista.', 'Conta Criada');
  };

  // Remover Conta Bancária
  const handleDeleteAccount = (id: string) => {
    setContasBancarias((prev) => prev.filter((c) => c.id !== id));
    addToast('info', 'Conta bancária removida da lista.');
  };

  // Marcar como Padrão
  const handleSetDefaultAccount = (id: string) => {
    setContasBancarias((prev) =>
      prev.map((c) => ({
        ...c,
        padrao: c.id === id,
      }))
    );
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Menu Lateral Admin */}
      <AdminSidebar currentPath="/admin/config" onNavigate={onNavigate} />

      {/* Conteúdo Principal */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Cabeçalho */}
        <header className="sticky top-0 z-30 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#D4AF37]">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Configurações de Negócio & Parâmetros Financeiros
                  </h1>
                  <p className="text-xs text-slate-400">
                    Margens por metal, limites de autorização e contas bancárias de liquidação
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchConfigs()}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Sincronizar Parâmetros"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
              </button>

              <button
                onClick={handleSaveConfigs}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>Guardar Parâmetros</span>
              </button>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex items-center gap-2 mt-5 border-t border-slate-800/60 pt-3">
            <button
              onClick={() => setActiveTab('margens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'margens'
                  ? 'bg-[#D4AF37] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Margens de Compra de Ouro & Metais</span>
            </button>

            <button
              onClick={() => setActiveTab('tetos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'tetos'
                  ? 'bg-[#D4AF37] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Tetos de Aprovação da Sede</span>
            </button>

            <button
              onClick={() => setActiveTab('contas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'contas'
                  ? 'bg-[#D4AF37] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Contas Bancárias de Liquidação</span>
            </button>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* =============================================================
              ABA 1: MARGENS DE COMPRA DE METAIS PRECIOSOS
             ============================================================= */}
          {activeTab === 'margens' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Card Explicativo com Fórmula de Cálculo */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#D4AF37]/20 text-[#D4AF37]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      Fórmula de Preço de Balcão Atualizada em Tempo Real
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Preço Compra (€/g) = Cotação Base &times; (Toque &divide; 1000) &times; (100% - Margem Empresa %)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
                  <Percent className="w-4 h-4" />
                  <span>Aplicação Global em toda a rede</span>
                </div>
              </div>

              {/* Tabela de Margens de Metais */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Tipo de Metal / Teor</th>
                        <th className="py-3 px-4">Toque (‰)</th>
                        <th className="py-3 px-4">Cotação Base (€/g)</th>
                        <th className="py-3 px-4">Margem Empresa (%)</th>
                        <th className="py-3 px-4">Preço Compra Balcão</th>
                        <th className="py-3 px-4">Flexibilidade Loja (%)</th>
                        <th className="py-3 px-4 text-center">Ativo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {margens.map((metal, idx) => (
                        <tr key={metal.id || idx} className="hover:bg-slate-800/30 transition-colors">
                          {/* Tipo de Metal */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-white">{metal.metal_tipo}</p>
                            <p className="text-[10px] text-slate-400">{metal.descricao}</p>
                          </td>

                          {/* Toque */}
                          <td className="py-3.5 px-4 font-mono text-[#D4AF37]">
                            {metal.toque_millesimos}‰
                          </td>

                          {/* Cotação Base */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1 font-mono">
                              <input
                                type="number"
                                step="0.10"
                                value={metal.cotacao_referencia_g}
                                onChange={(e) =>
                                  handleMargemChange(idx, 'cotacao_referencia_g', parseFloat(e.target.value) || 0)
                                }
                                className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                              />
                              <span className="text-slate-400">€/g</span>
                            </div>
                          </td>

                          {/* Margem Empresa */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-mono">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="80"
                                value={metal.margem_percentagem}
                                onChange={(e) =>
                                  handleMargemChange(idx, 'margem_percentagem', parseFloat(e.target.value) || 0)
                                }
                                className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                              />
                              <span className="text-slate-400">%</span>
                            </div>
                          </td>

                          {/* Preço Compra Calculado */}
                          <td className="py-3.5 px-4 font-mono text-sm font-bold text-emerald-400">
                            {Number(metal.preco_compra_grama).toFixed(2)} €/g
                          </td>

                          {/* Flexibilidade Loja */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="15"
                                value={metal.desconto_maximo_loja_perc}
                                onChange={(e) =>
                                  handleMargemChange(idx, 'desconto_maximo_loja_perc', parseFloat(e.target.value) || 0)
                                }
                                className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                              />
                              <span className="text-slate-400">%</span>
                            </div>
                          </td>

                          {/* Ativo */}
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={metal.ativo !== false}
                              onChange={(e) => {
                                const copy = [...margens];
                                copy[idx].ativo = e.target.checked;
                                setMargens(copy);
                              }}
                              className="w-4 h-4 accent-[#D4AF37] cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================
              ABA 2: TETOS DE APROVAÇÃO DA SEDE
             ============================================================= */}
          {activeTab === 'tetos' && (
            <div className="space-y-6 max-w-3xl animate-in fade-in">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#D4AF37]">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Parâmetros de Bloqueio & Alçada de Aprovação
                    </h2>
                    <p className="text-xs text-slate-400">
                      Transações que excedam estes limites ficam retidas para validação pelo Master User
                    </p>
                  </div>
                </div>

                {/* Limite de Valor */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Teto Máximo de Compra Sem Aprovação da Sede (€)
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Compras de ouro com valor superior entram em estado <code>pendente_aprovacao</code>.
                  </p>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      step="50"
                      value={tetos.valor_limite_sem_aprovacao}
                      onChange={(e) =>
                        setTetos({ ...tetos, valor_limite_sem_aprovacao: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                    <span className="text-sm font-mono text-slate-400">EUR</span>
                  </div>
                </div>

                {/* Limite de Peso */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">
                    Teto Máximo de Peso Sem Aprovação da Sede (Gramas)
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Lotes de peças com peso bruto superior a este limite requerem validação da sede.
                  </p>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      step="5"
                      value={tetos.peso_limite_sem_aprovacao_g}
                      onChange={(e) =>
                        setTetos({ ...tetos, peso_limite_sem_aprovacao_g: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                    <span className="text-sm font-mono text-slate-400">gramas</span>
                  </div>
                </div>

                {/* Dupla Assinatura */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-white mb-1">
                    Exigir Dupla Assinatura (Gerente + Sede) Acima de (€)
                  </label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="number"
                      step="500"
                      value={tetos.exigir_dupla_assinatura_acima}
                      onChange={(e) =>
                        setTetos({ ...tetos, exigir_dupla_assinatura_acima: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                    <span className="text-sm font-mono text-slate-400">EUR</span>
                  </div>
                </div>

                {/* Notificação WhatsApp Master */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="pr-4">
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#D4AF37]" />
                      <span>Notificar Master User por WhatsApp (+351937230116)</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Dispara mensagem automática instantânea quando um balcão submeter transação acima do teto
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tetos.notificar_whatsapp_master}
                      onChange={(e) => setTetos({ ...tetos, notificar_whatsapp_master: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================
              ABA 3: CONTAS BANCÁRIAS DE LIQUIDAÇÃO
             ============================================================= */}
          {activeTab === 'contas' && (
            <div className="space-y-6 max-w-4xl animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Contas de Tesouraria para Pagamento a Clientes
                  </h2>
                  <p className="text-xs text-slate-400">
                    Contas utilizadas para transferências bancárias e comprovativos de liquidação
                  </p>
                </div>
                <button
                  onClick={() => setIsNewAccountOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-white font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#D4AF37]" />
                  <span>Adicionar Conta</span>
                </button>
              </div>

              {/* Grid de Contas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contasBancarias.map((conta) => (
                  <div
                    key={conta.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      conta.padrao
                        ? 'bg-gradient-to-br from-slate-900 to-amber-950/20 border-[#D4AF37]/50 shadow-lg'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-slate-800 text-[#D4AF37] border border-slate-700">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{conta.banco}</p>
                          <p className="text-[11px] text-slate-400">{conta.titular}</p>
                        </div>
                      </div>

                      {conta.padrao && (
                        <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono border border-[#D4AF37]/30">
                          Padrão
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <p className="text-[10px] font-mono text-slate-400 uppercase">IBAN Oficial</p>
                      <p className="text-xs font-mono font-bold text-white tracking-wider mt-0.5 select-all">
                        {conta.iban}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs pt-2">
                      {!conta.padrao ? (
                        <button
                          onClick={() => handleSetDefaultAccount(conta.id)}
                          className="text-[11px] text-[#D4AF37] hover:underline font-mono cursor-pointer"
                        >
                          Definir como Padrão
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" /> Conta Principal
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteAccount(conta.id)}
                        className="text-slate-400 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                        title="Remover Conta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Adicionar Nova Conta */}
              {isNewAccountOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                  <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                        <span>Adicionar Conta Bancária</span>
                      </h3>
                      <button
                        onClick={() => setIsNewAccountOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Instituição Bancária
                        </label>
                        <select
                          value={newAccount.banco}
                          onChange={(e) => setNewAccount({ ...newAccount, banco: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                        >
                          <option value="Millennium BCP">Millennium BCP</option>
                          <option value="Caixa Geral de Depósitos">Caixa Geral de Depósitos (CGD)</option>
                          <option value="Santander Totta">Santander Totta</option>
                          <option value="Novo Banco">Novo Banco</option>
                          <option value="Banco BPI">Banco BPI</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          IBAN Português (PT50...)
                        </label>
                        <input
                          type="text"
                          value={newAccount.iban}
                          onChange={(e) => setNewAccount({ ...newAccount, iban: e.target.value })}
                          placeholder="PT50 0033 0000 1234 5678 9012 3"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Titular da Conta
                        </label>
                        <input
                          type="text"
                          value={newAccount.titular}
                          onChange={(e) => setNewAccount({ ...newAccount, titular: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="isPadrao"
                          checked={newAccount.padrao}
                          onChange={(e) => setNewAccount({ ...newAccount, padrao: e.target.checked })}
                          className="w-4 h-4 accent-[#D4AF37]"
                        />
                        <label htmlFor="isPadrao" className="text-xs text-slate-300 cursor-pointer">
                          Definir como conta padrão para liquidações imediatas
                        </label>
                      </div>

                      <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                        <button
                          onClick={() => setIsNewAccountOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddAccount}
                          className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold"
                        >
                          Guardar Conta
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
