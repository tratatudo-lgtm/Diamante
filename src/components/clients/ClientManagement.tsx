// PATH: src/components/clients/ClientManagement.tsx
import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  FileText,
  Eye,
  Edit,
  X,
  Filter,
  ArrowUpRight,
  ChevronRight,
  AlertTriangle,
  Lock,
  Unlock,
  CreditCard,
  Plus,
} from 'lucide-react';
import { useClients, useStores } from '../../hooks/useSupabaseData';

export type ClientStatus = 'vip' | 'normal' | 'bloqueado' | '';

export interface ClientTransactionRecord {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  pesoGramas: number;
  lojaNome: string;
}

export interface Client {
  id: string;
  codigoCliente: string;
  nome: string;
  nif: string;
  telemovel: string;
  email: string;
  docIdentificacao: string; // Ex: CC 14892301 2 ZX4
  dataNascimento: string;
  morada: string;
  cidade: string;
  lojaOrigemId: string;
  lojaOrigemNome: string;
  status: ClientStatus;
  totalTransacoes: number;
  totalCompradoEUR: number; // Volume total pago ao cliente pelas peças vendidas
  ultimaVisita: string;
  dataRegisto: string;
  notasInternas: string;
  historico: ClientTransactionRecord[];
}

export interface ClientManagementProps {
  onNavigate?: (path: string) => void;
}

export const ClientManagement: React.FC<ClientManagementProps> = ({ onNavigate }) => {
  const { data: clients, loading, error: dataError, createClient, toggleBlockClient, toggleVipClient } = useClients();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: stores, error: storesError } = useStores();
  const storeOptions = stores.map((store) => ({ id: store.id, nome: store.nome }));

  // Filtros de Pesquisa & Visualização
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ClientStatus>('todos');
  const [storeFilter, setStoreFilter] = useState<string>('todas');

  // Modais de Ação
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // Form State para Novo Cliente
  const [newClient, setNewClient] = useState({
    nome: '',
    nif: '',
    telemovel: '',
    email: '',
    docIdentificacao: '',
    dataNascimento: '',
    morada: '',
    cidade: '',
    lojaOrigemId: '',
    status: 'normal' as ClientStatus,
    notasInternas: '',
    consentimentoRgpd: false,
  });

  // =========================================================
  // 1. STATS CALCULADAS EM TEMPO REAL
  // =========================================================
  const { totalClients, vipCount, blockedCount, totalVolumeEUR } = useMemo(() => {
    let vip = 0;
    let blocked = 0;
    let volume = 0;

    clients.forEach((c) => {
      if (c.status === 'vip') vip++;
      if (c.status === 'bloqueado') blocked++;
      volume += c.totalCompradoEUR;
    });

    return {
      totalClients: clients.length,
      vipCount: vip,
      blockedCount: blocked,
      totalVolumeEUR: volume,
    };
  }, [clients]);

  // Formatação Moeda EUR
  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // =========================================================
  // 2. FILTRAGEM DE CLIENTES
  // =========================================================
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Filtro Status
      if (statusFilter !== 'todos' && client.status !== statusFilter) {
        return false;
      }

      // Filtro Loja de Origem
      if (storeFilter !== 'todas' && client.lojaOrigemId !== storeFilter) {
        return false;
      }

      // Pesquisa por Texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchNome = client.nome.toLowerCase().includes(q);
        const matchNif = (client.nif || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        const matchTel = client.telemovel.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
        const matchDoc = client.docIdentificacao.toLowerCase().includes(q);
        const matchEmail = client.email.toLowerCase().includes(q);
        const matchCidade = client.cidade.toLowerCase().includes(q);
        const matchLoja = client.lojaOrigemNome.toLowerCase().includes(q);

        if (!matchNome && !matchNif && !matchTel && !matchDoc && !matchEmail && !matchCidade && !matchLoja) {
          return false;
        }
      }

      return true;
    });
  }, [clients, statusFilter, storeFilter, searchTerm]);

  // =========================================================
  // 3. AÇÕES SOBRE CLIENTES (MUDAR STATUS / CRIAR)
  // =========================================================
  const handleToggleBlockClient = async (clientId: string) => {
    try {
      await toggleBlockClient(clientId);
      if (selectedClient?.id === clientId) {
        setSelectedClient((prev) => prev ? { ...prev, status: prev.status === 'bloqueado' ? 'normal' : 'bloqueado' } : null);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao alterar o estado do cliente.');
    }
  };

  const handleToggleVipClient = async (clientId: string) => {
    try {
      await toggleVipClient(clientId);
      if (selectedClient?.id === clientId) {
        setSelectedClient((prev) => prev ? { ...prev, status: prev.status === 'vip' ? 'normal' : 'vip' } : null);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao alterar o estatuto VIP.');
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.nome.trim() || !newClient.nif.trim() || !newClient.docIdentificacao.trim() || !newClient.consentimentoRgpd) { setActionError('Nome, NIF, Cartão de Cidadão e consentimento RGPD são obrigatórios.'); return; }
    const nif = newClient.nif.replace(/\D/g, '');
    if (!/^\d{9}$/.test(nif)) { setActionError('O NIF deve conter exatamente 9 algarismos.'); return; }
    const storeObj = storeOptions.find((store) => store.id === newClient.lojaOrigemId);
    const newId = `cli-${Date.now()}`;
    const nextCode = `CLI-${String(clients.length + 1).padStart(3, '0')}`;
    const created: Client = {
      id: newId, codigoCliente: nextCode, nome: newClient.nome.trim(), nif,
      telemovel: newClient.telemovel.trim(), email: newClient.email.trim(),
      docIdentificacao: newClient.docIdentificacao.trim(), dataNascimento: newClient.dataNascimento,
      morada: newClient.morada.trim(), cidade: newClient.cidade.trim(),
      lojaOrigemId: newClient.lojaOrigemId, lojaOrigemNome: storeObj?.nome || '',
      status: newClient.status, totalTransacoes: 0, totalCompradoEUR: 0,
      ultimaVisita: '', dataRegisto: new Date().toLocaleDateString('pt-PT'),
      notasInternas: newClient.notasInternas.trim(), historico: [],
    };
    try {
      await createClient(created);
      setIsNewClientModalOpen(false);
      setNewClient({ nome: '', nif: '', telemovel: '', email: '', docIdentificacao: '', dataNascimento: '', morada: '', cidade: '', lojaOrigemId: '', status: 'normal', notasInternas: '', consentimentoRgpd: false });
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao criar o cliente.');
    }
  };

  // Helper de Badge de Status
  const renderStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case 'vip':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-[#D4AF37]/30 shadow-xs shadow-amber-500/10">
            <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
            <span>VIP Especial</span>
          </span>
        );
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Normal Conforme</span>
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs shadow-rose-500/10">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Blacklist / Bloqueado</span>
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-400">Não definido</span>;
    }
  };

  // Iniciais do Nome
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {(dataError || storesError) && <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{dataError || storesError}</div>}
      {actionError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <div className="flex items-center justify-between gap-3">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="Fechar aviso">×</button>
          </div>
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
                <Users className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Clientes & Fornecedores
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Ficha de Identificação Legal, Rastreabilidade de Peças e Histórico de Confiança
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
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" />
            <span>Novo Cliente</span>
          </button>
        </header>

        {/* =========================================================
            2. STATS CARDS
           ========================================================= */}
        <section
          aria-label="Indicadores da Carteira de Clientes"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Total Clientes */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Clientes Registados
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {totalClients}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Volume liquidado: <strong className="text-white font-mono">{formatEUR(totalVolumeEUR)}</strong>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: VIPs (>5 transações) */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Clientes VIP (&gt;5 Transações)
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                {vipCount}
              </p>
              <p className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                Alta fidelização e verificação prévia
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Star className="w-6 h-6 fill-[#D4AF37]/30" />
            </div>
          </div>

          {/* Card 3: Blacklist / Bloqueados */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Blacklist / Bloqueados
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-400">
                {blockedCount}
              </p>
              <p className="text-[11px] text-rose-400/90 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Divergências legais ou contrafações
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS RÁPIDOS
           ========================================================= */}
        <section
          aria-label="Filtros e Pesquisa de Clientes"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
        >
          {/* Linha 1: Pesquisa + Filtro por Loja */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome, NIF, telemóvel, CC ou cidade..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown de Balcão de Origem */}
            <div className="w-full md:w-72 shrink-0">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0b0f19] border border-slate-700/70 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
              >
                <option value="todas">Todas as Lojas ({storeOptions.length})</option>
                {storeOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Filtros Pill por Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Status:
              </span>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'todos'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({clients.length})
              </button>
              <button
                onClick={() => setStatusFilter('vip')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'vip'
                    ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-[#D4AF37] border border-slate-800'
                }`}
              >
                VIP ({vipCount})
              </button>
              <button
                onClick={() => setStatusFilter('normal')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'normal'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                Normal ({clients.filter((c) => c.status === 'normal').length})
              </button>
              <button
                onClick={() => setStatusFilter('bloqueado')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'bloqueado'
                    ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                Blacklist ({blockedCount})
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Mostrando <strong className="text-white">{filteredClients.length}</strong> de {clients.length} clientes
            </div>
          </div>
        </section>

        {/* =========================================================
            4. LISTA / TABELA RESPONSIVA DE CLIENTES
           ========================================================= */}
        <section aria-label="Carteira de Clientes">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Users className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">Nenhum cliente encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem clientes que correspondam aos filtros de pesquisa selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('todos');
                  setStoreFilter('todas');
                }}
                className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
              >
                Limpar filtros de pesquisa
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW: Tabela Elegante (Visível em md+) */}
              <div className="hidden md:block rounded-2xl bg-[#151b2b] border border-slate-800/90 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b0f19] text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Cliente / Código</th>
                        <th className="py-3.5 px-4">NIF & Identificação</th>
                        <th className="py-3.5 px-4">Contacto</th>
                        <th className="py-3.5 px-4">Balcão Frequente</th>
                        <th className="py-3.5 px-4">Total Comprado</th>
                        <th className="py-3.5 px-4">Última Visita</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredClients.map((client) => (
                        <tr
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Nome e Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  client.status === 'vip'
                                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                                    : client.status === 'bloqueado'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                                }`}
                              >
                                {getInitials(client.nome)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors truncate max-w-[180px]">
                                  {client.nome}
                                </p>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {client.codigoCliente} &bull; {client.cidade}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* NIF */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-100">
                              {client.nif}
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                              {client.docIdentificacao}
                            </p>
                          </td>

                          {/* Contacto */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{client.telemovel}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {client.email}
                            </p>
                          </td>

                          {/* Balcão */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 max-w-[170px] truncate" title={client.lojaOrigemNome}>
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-slate-200">
                                {client.lojaOrigemNome.replace("Diamante D'ouro - ", '')}
                              </span>
                            </div>
                          </td>

                          {/* Total Comprado */}
                          <td className="py-3.5 px-4">
                            <p className="font-mono font-bold text-white text-xs">
                              {formatEUR(client.totalCompradoEUR)}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              {client.totalTransacoes} {client.totalTransacoes === 1 ? 'venda' : 'vendas'}
                            </p>
                          </td>

                          {/* Última Visita */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            {client.ultimaVisita}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(client.status)}
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleVipClient(client.id)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  client.status === 'vip'
                                    ? 'bg-amber-500/20 text-[#D4AF37] border-[#D4AF37]/40'
                                    : 'bg-slate-800 text-slate-400 hover:text-[#D4AF37] border-slate-700'
                                }`}
                                title={client.status === 'vip' ? 'Remover estatuto VIP' : 'Promover a VIP'}
                              >
                                <Star className={`w-3.5 h-3.5 ${client.status === 'vip' ? 'fill-[#D4AF37]' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleToggleBlockClient(client.id)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  client.status === 'bloqueado'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : 'bg-slate-800 text-slate-400 hover:text-rose-400 border-slate-700'
                                }`}
                                title={client.status === 'bloqueado' ? 'Desbloquear Cliente' : 'Bloquear / Colocar na Blacklist'}
                              >
                                {client.status === 'bloqueado' ? (
                                  <Unlock className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => setSelectedClient(client)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] border border-slate-700 transition-colors cursor-pointer"
                                title="Ver Perfil Completo & Histórico"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE VIEW: Cards Elegantes (Visível em <md) */}
              <div className="md:hidden space-y-3">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            client.status === 'vip'
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                              : client.status === 'bloqueado'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {getInitials(client.nome)}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-bold text-sm text-white truncate">
                            {client.nome}
                          </h2>
                          <p className="text-[10px] font-mono text-slate-400">
                            NIF: {client.nif} &bull; {client.codigoCliente}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {renderStatusBadge(client.status)}
                      </div>
                    </div>

                    {/* Informações Centrais */}
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Telemóvel:</span>
                        <span className="font-mono text-slate-100">{client.telemovel}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balcão Origem:</span>
                        <span className="truncate max-w-[180px] text-white">
                          {client.lojaOrigemNome.replace("Diamante D'ouro - ", '')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Total Pago em Compras:</span>
                        <span className="font-mono font-bold text-[#D4AF37]">
                          {formatEUR(client.totalCompradoEUR)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400">Última Visita:</span>
                        <span className="font-mono text-slate-300">{client.ultimaVisita}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE PERFIL DO CLIENTE (Histórico & Dados Legais)
           ========================================================= */}
        {selectedClient && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedClient(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Perfil */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-lg ${
                      selectedClient.status === 'vip'
                        ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-2 border-[#D4AF37]/50 shadow-[#D4AF37]/10'
                        : selectedClient.status === 'bloqueado'
                        ? 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/50 shadow-rose-500/10'
                        : 'bg-slate-800 text-slate-200 border-2 border-slate-700'
                    }`}
                  >
                    {getInitials(selectedClient.nome)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-white">
                        {selectedClient.nome}
                      </h3>
                      {renderStatusBadge(selectedClient.status)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Ref: {selectedClient.codigoCliente} &bull; Registado a {selectedClient.dataRegisto}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo com Informações & Histórico */}
              <div className="p-6 space-y-6 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
                {/* 1. Dados Pessoais & Documentação Legal */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dados Pessoais & Identificação Legal (KYC)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">NIF (Contribuinte):</span>
                      <strong className="text-white font-mono">{selectedClient.nif}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Documento de Identificação:</span>
                      <span className="text-white font-mono">{selectedClient.docIdentificacao}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Telemóvel:</span>
                      <span className="text-white font-mono">{selectedClient.telemovel}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email:</span>
                      <span className="text-slate-200">{selectedClient.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Data de Nascimento:</span>
                      <span className="text-white font-mono">{selectedClient.dataNascimento}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Balcão Habitual:</span>
                      <span className="text-white">{selectedClient.lojaOrigemNome}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Morada Completa:</span>
                      <span className="text-slate-200">{selectedClient.morada}, {selectedClient.cidade}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Resumo de Compras */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Transações</span>
                    <strong className="text-lg text-white font-mono">{selectedClient.totalTransacoes}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Volume Total Pago</span>
                    <strong className="text-lg text-[#D4AF37] font-mono">{formatEUR(selectedClient.totalCompradoEUR)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Última Visita</span>
                    <strong className="text-xs text-white font-mono">{selectedClient.ultimaVisita}</strong>
                  </div>
                </div>

                {/* 3. Notas Internas & Compliance */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                      Notas Internas & Conformidade Legal
                    </span>
                    {selectedClient.status === 'bloqueado' && (
                      <span className="text-[10px] font-mono text-rose-400 uppercase font-bold">
                        Atenção Requerida
                      </span>
                    )}
                  </h4>
                  <p className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 leading-relaxed italic">
                    "{selectedClient.notasInternas}"
                  </p>
                </div>

                {/* 4. Histórico de Vendas / Transações */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-[#D4AF37]" />
                      Histórico Recente de Transações
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {selectedClient.historico.length} registos
                    </span>
                  </h4>

                  {selectedClient.historico.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-[#0b0f19] border border-slate-800 text-slate-400">
                      Sem transações anteriores registadas para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedClient.historico.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate text-xs">
                              {tx.descricao}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {tx.data} &bull; {tx.lojaNome.replace("Diamante D'ouro - ", '')} &bull; {tx.pesoGramas}g
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-sm text-[#D4AF37]">
                              {formatEUR(tx.valor)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ações do Rodapé do Modal */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleVipClient(selectedClient.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedClient.status === 'vip'
                        ? 'bg-amber-500/15 text-[#D4AF37] border-[#D4AF37]/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${selectedClient.status === 'vip' ? 'fill-[#D4AF37]' : ''}`} />
                    <span>{selectedClient.status === 'vip' ? 'Remover VIP' : 'Promover VIP'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleBlockClient(selectedClient.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedClient.status === 'bloqueado'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {selectedClient.status === 'bloqueado' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Desbloquear Cliente</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Bloquear na Blacklist</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedClient(null)}
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer ml-auto"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL: NOVO CLIENTE (Formulário)
           ========================================================= */}
        {isNewClientModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsNewClientModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#D4AF37]" />
                  <span>Ficha de Registo de Novo Cliente</span>
                </h3>
                <button
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="p-6 space-y-4 text-xs">
                {/* Nome Completo */}
                <div>
                  <label className="block text-slate-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newClient.nome}
                    onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
                    placeholder="Ex: João Miguel Santos"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 mb-1">NIF Português (9 dígitos) *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={newClient.nif}
                      onChange={(e) => setNewClient({ ...newClient, nif: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                      placeholder="213456789"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Telemóvel */}
                  <div>
                    <label className="block text-slate-400 mb-1">Telemóvel (+351) *</label>
                    <input
                      type="text"
                      required
                      value={newClient.telemovel}
                      onChange={(e) => setNewClient({ ...newClient, telemovel: e.target.value })}
                      placeholder="+351 912 345 678"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Doc Identificação */}
                  <div>
                    <label className="block text-slate-400 mb-1">Cartão de Cidadão / Documento de Identificação *</label>
                    <input
                      type="text"
                      required
                      value={newClient.docIdentificacao}
                      onChange={(e) => setNewClient({ ...newClient, docIdentificacao: e.target.value })}
                      placeholder="CC 12345678 9 ZX1"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Data Nascimento */}
                  <div>
                    <label className="block text-slate-400 mb-1">Data Nascimento</label>
                    <input
                      type="text"
                      value={newClient.dataNascimento}
                      onChange={(e) => setNewClient({ ...newClient, dataNascimento: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="cliente@exemplo.pt"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Morada & Cidade */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1">Morada Residência</label>
                    <input
                      type="text"
                      value={newClient.morada}
                      onChange={(e) => setNewClient({ ...newClient, morada: e.target.value })}
                      placeholder="Rua, Número, Andar"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={newClient.cidade}
                      onChange={(e) => setNewClient({ ...newClient, cidade: e.target.value })}
                      placeholder="Lisboa"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Balcão */}
                  <div>
                    <label className="block text-slate-400 mb-1">Balcão de Registo</label>
                    <select
                      value={newClient.lojaOrigemId}
                      onChange={(e) => setNewClient({ ...newClient, lojaOrigemId: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      {storeOptions.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Inicial */}
                  <div>
                    <label className="block text-slate-400 mb-1">Classificação Inicial</label>
                    <select
                      value={newClient.status}
                      onChange={(e) => setNewClient({ ...newClient, status: e.target.value as ClientStatus })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="normal">Normal (Conforme)</option>
                      <option value="vip">VIP (Fornecedor Regular)</option>
                      <option value="bloqueado">Blacklist (Suspeito / Bloqueado)</option>
                    </select>
                  </div>
                </div>

                {/* Notas Internas */}
                <div>
                  <label className="block text-slate-400 mb-1">Notas Internas de Conformidade</label>
                  <textarea
                    rows={2}
                    value={newClient.notasInternas}
                    onChange={(e) => setNewClient({ ...newClient, notasInternas: e.target.value })}
                    placeholder="Observações sobre proveniência das peças ou verificação documental..."
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <label className="flex items-start gap-2 rounded-xl border border-slate-700 bg-[#0b0f19] p-3 text-slate-300">
                  <input type="checkbox" required checked={newClient.consentimentoRgpd} onChange={(e) => setNewClient({ ...newClient, consentimentoRgpd: e.target.checked })} className="mt-0.5 accent-[#D4AF37]" />
                  <span>Confirmo que o cliente foi informado e deu consentimento para o tratamento dos seus dados pessoais, nos termos aplicáveis do RGPD. *</span>
                </label>

                {/* Botões */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewClientModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Criar Ficha de Cliente
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

export default ClientManagement;
