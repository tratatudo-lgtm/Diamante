// PATH: src/components/stores/StoreManagement.tsx
import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  User,
  Phone,
  Clock,
  TrendingUp,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Mail,
  FileText,
  Calendar,
  Scale,
  Sparkles,
  ArrowUpRight,
  Filter,
  Loader2,
} from 'lucide-react';
import { useStores } from '../../hooks/useSupabaseData';

export interface Store {
  id: string;
  codigo: string;
  nome: string;
  status: 'ativa' | 'inativa';
  endereco: string;
  cidade: string;
  gerente: string;
  telefone: string;
  email: string;
  horario: string;
  nif: string;
  volumeMes: number;
  metaMes: number;
  progressoMeta: number;
  totalTransacoesMes: number;
  ouroCompradoGramas: number;
  dataAbertura: string;
}

// Array inicial com as 24 lojas reais "Diamante D'ouro" em Portugal
export const StoreManagement: React.FC = () => {
  const { data: stores, loading, createStore, updateStore, deleteStore } = useStores();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'ativa' | 'inativa'>('todas');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Modal "+ Nova Loja"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStore, setNewStore] = useState({
    nome: '',
    endereco: '',
    cidade: '',
    gerente: '',
    telefone: '',
    email: '',
    horario: '',
    nif: '',
    metaMes: 0,
    status: 'ativa' as 'ativa' | 'inativa',
  });

  // Modal "Editar Loja"
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  // Confirmação Eliminar
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // 1. Estatísticas Calculadas
  const activeStores = useMemo(() => stores.filter((s) => s.status === 'ativa'), [stores]);
  const totalStoresCount = stores.length;
  const activeStoresCount = activeStores.length;

  const totalVolumeMes = useMemo(() => {
    return activeStores.reduce((acc, s) => acc + s.volumeMes, 0);
  }, [activeStores]);

  const mediaPorLoja = useMemo(() => {
    if (activeStoresCount === 0) return 0;
    return Math.round(totalVolumeMes / activeStoresCount);
  }, [totalVolumeMes, activeStoresCount]);

  // 2. Filtragem de Lojas
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      // Filtro de Status
      if (statusFilter === 'ativa' && store.status !== 'ativa') return false;
      if (statusFilter === 'inativa' && store.status !== 'inativa') return false;

      // Filtro de Texto (Nome, Endereço ou Gerente)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchNome = store.nome.toLowerCase().includes(query);
        const matchEndereco = store.endereco.toLowerCase().includes(query);
        const matchCidade = store.cidade.toLowerCase().includes(query);
        const matchGerente = store.gerente.toLowerCase().includes(query);
        const matchCodigo = store.codigo.toLowerCase().includes(query);

        if (!matchNome && !matchEndereco && !matchCidade && !matchGerente && !matchCodigo) {
          return false;
        }
      }

      return true;
    });
  }, [stores, searchTerm, statusFilter]);

  // Formatação em Euros
  const formatEUR = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Criar Nova Loja (Supabase)
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.nome.trim() || !newStore.endereco.trim()) return;

    await createStore({
      nome: newStore.nome.trim(),
      status: newStore.status,
      endereco: newStore.endereco.trim(),
      cidade: newStore.cidade.trim(),
      gerente: newStore.gerente.trim(),
      telefone: newStore.telefone.trim(),
      email: newStore.email.trim(),
      horario: newStore.horario.trim(),
      nif: newStore.nif.trim(),
      metaMes: Number(newStore.metaMes) || 0,
    });

    setIsCreateModalOpen(false);
    setNewStore({
      nome: '',
      endereco: '',
      cidade: '',
      gerente: '',
      telefone: '',
      email: '',
      horario: '',
      nif: '',
      metaMes: 0,
      status: 'ativa',
    });
  };

  // Guardar Edição (Supabase)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;

    await updateStore(editingStore.id, editingStore);
    if (selectedStore?.id === editingStore.id) {
      setSelectedStore(editingStore);
    }
    setIsEditModalOpen(false);
    setEditingStore(null);
  };

  // Eliminar / Desativar Loja (Supabase)
  const handleDeleteStore = async (id: string) => {
    await deleteStore(id);
    setIsDeletingId(null);
    setSelectedStore(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* =========================================================
            1. HEADER
           ========================================================= */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-[#D4AF37]/20 shrink-0">
                <Building2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Gestão de Lojas
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Rede Nacional de Compra de Ouro "Diamante D'ouro"
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nova Loja</span>
          </button>
        </header>

        {/* =========================================================
            2. CARDS DE ESTATÍSTICAS DO TOPO
           ========================================================= */}
        <section
          aria-label="Indicadores da Rede"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Lojas Ativas */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Lojas Ativas
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {activeStoresCount}
                </p>
                <span className="text-xs font-mono text-slate-400">
                  / {totalStoresCount} balcões
                </span>
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {Math.round((activeStoresCount / totalStoresCount) * 100)}% em operação
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Volume Total Mês */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Volume Total Mês
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#D4AF37]">
                {formatEUR(totalVolumeMes)}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Compras de ouro liquidadas
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Média por Loja */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Média por Loja
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {formatEUR(mediaPorLoja)}
              </p>
              <p className="text-[11px] text-emerald-400 font-medium">
                Meta média: ~33.000 € / balcão
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS FUNCIONAIS
           ========================================================= */}
        <section
          aria-label="Filtros de Pesquisa"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg"
        >
          {/* Campo de Busca */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome, morada, cidade ou gerente..."
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

          {/* Filtro de Status */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Filtrar:
            </span>
            <div className="flex items-center p-1 bg-[#0b0f19] rounded-xl border border-slate-700/70 text-xs">
              <button
                onClick={() => setStatusFilter('todas')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'todas'
                    ? 'bg-[#D4AF37] text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({stores.length})
              </button>
              <button
                onClick={() => setStatusFilter('ativa')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ativa'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Ativas ({activeStoresCount})
              </button>
              <button
                onClick={() => setStatusFilter('inativa')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'inativa'
                    ? 'bg-rose-500 text-white font-bold'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                Inativas ({totalStoresCount - activeStoresCount})
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================
            4. GRID RESPONSIVO DE CARDS DE LOJAS
           ========================================================= */}
        <section aria-label="Catálogo de Lojas">
          {filteredStores.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">
                Nenhuma loja encontrada
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem balcões que correspondam aos termos de pesquisa ou filtros aplicados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('todas');
                }}
                className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStores.map((store) => {
                const isAtiva = store.status === 'ativa';
                const progressClamped = Math.min(store.progressoMeta, 100);

                return (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStore(store)}
                    className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800 hover:border-[#D4AF37]/50 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:shadow-[#D4AF37]/5 flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Linha de Destaque Dourada no Topo ao Hover */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div>
                      {/* Topo do Card: Nome e Status Badge */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono text-[#D4AF37] font-semibold tracking-wider">
                            {store.codigo}
                          </span>
                          <h2 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors truncate">
                            {store.nome}
                          </h2>
                          <p className="text-xs text-slate-400 font-medium">
                            {store.cidade}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                            isAtiva
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAtiva ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {isAtiva ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>

                      {/* Informações da Loja */}
                      <div className="py-4 space-y-2.5 text-xs text-slate-300">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 text-slate-300">
                            {store.endereco}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Gerente: <strong className="text-white font-medium">{store.gerente}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-400">
                            {store.telefone}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-400">
                            {store.horario}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé: Barra de Progresso de Desempenho Mensal */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[11px] text-slate-400">
                          Desempenho Mês:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">
                            {formatEUR(store.volumeMes)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            / {formatEUR(store.metaMes)}
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              store.progressoMeta >= 100
                                ? 'text-emerald-400'
                                : store.progressoMeta >= 80
                                ? 'text-[#D4AF37]'
                                : 'text-slate-400'
                            }`}
                          >
                            ({store.progressoMeta}%)
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            store.progressoMeta >= 100
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-amber-600 to-[#D4AF37]'
                          }`}
                          style={{ width: `${progressClamped}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE DETALHES DA LOJA
           ========================================================= */}
        {selectedStore && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedStore(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-700 flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-md">
                    <Building2 className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                        {selectedStore.codigo}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          selectedStore.status === 'ativa'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            selectedStore.status === 'ativa'
                              ? 'bg-emerald-400'
                              : 'bg-rose-400'
                          }`}
                        />
                        {selectedStore.status === 'ativa' ? 'Em Atividade' : 'Encerrada'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1">
                      {selectedStore.nome}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStore(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo com Todas as Informações */}
              <div className="p-6 space-y-6 text-sm">
                {/* Seção 1: Indicadores do Balcão */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] mb-3">
                    Desempenho Operacional do Mês
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                      <p className="text-[11px] text-slate-400">Volume Total</p>
                      <p className="text-base font-bold text-white font-mono mt-0.5">
                        {formatEUR(selectedStore.volumeMes)}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                      <p className="text-[11px] text-slate-400">Meta Estabelecida</p>
                      <p className="text-base font-bold text-slate-300 font-mono mt-0.5">
                        {formatEUR(selectedStore.metaMes)}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                      <p className="text-[11px] text-slate-400">Taxa de Cumprimento</p>
                      <p className={`text-base font-bold font-mono mt-0.5 ${
                        selectedStore.progressoMeta >= 100 ? 'text-emerald-400' : 'text-[#D4AF37]'
                      }`}>
                        {selectedStore.progressoMeta}%
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                      <p className="text-[11px] text-slate-400">Ouro Comprado</p>
                      <p className="text-base font-bold text-white font-mono mt-0.5">
                        {selectedStore.ouroCompradoGramas.toFixed(1)} g
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seção 2: Localização & Contactos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Localização e Fiscal */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#D4AF37]" />
                      <span>Localização & Dados Oficiais</span>
                    </h4>
                    <div className="text-xs space-y-1.5 text-slate-300">
                      <p>
                        <span className="text-slate-400">Morada:</span> {selectedStore.endereco}
                      </p>
                      <p>
                        <span className="text-slate-400">Cidade:</span> {selectedStore.cidade}
                      </p>
                      <p>
                        <span className="text-slate-400">NIF Estabelecimento:</span>{' '}
                        <strong className="font-mono text-white">{selectedStore.nif}</strong>
                      </p>
                      <p>
                        <span className="text-slate-400">Data de Abertura:</span>{' '}
                        <span className="font-mono">{selectedStore.dataAbertura}</span>
                      </p>
                    </div>
                  </div>

                  {/* Gestão e Contactos */}
                  <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-[#D4AF37]" />
                      <span>Gestão & Horário de Atendimento</span>
                    </h4>
                    <div className="text-xs space-y-1.5 text-slate-300">
                      <p>
                        <span className="text-slate-400">Gerente Responsável:</span>{' '}
                        <strong className="text-white">{selectedStore.gerente}</strong>
                      </p>
                      <p>
                        <span className="text-slate-400">Telefone:</span>{' '}
                        <span className="font-mono text-white">{selectedStore.telefone}</span>
                      </p>
                      <p>
                        <span className="text-slate-400">Email:</span>{' '}
                        <span className="text-[#D4AF37]">{selectedStore.email}</span>
                      </p>
                      <p>
                        <span className="text-slate-400">Horário:</span> {selectedStore.horario}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé com Botões de Ação */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                <button
                  onClick={() => setIsDeletingId(selectedStore.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Balcão</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingStore(selectedStore);
                      setIsEditModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Editar Loja</span>
                  </button>

                  <button
                    onClick={() => setSelectedStore(null)}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL: NOVA LOJA
           ========================================================= */}
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#D4AF37]" />
                  <span>Adicionar Novo Balcão</span>
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStore} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nome da Loja *</label>
                  <input
                    type="text"
                    required
                    value={newStore.nome}
                    onChange={(e) => setNewStore({ ...newStore, nome: e.target.value })}
                    placeholder="Ex: Diamante D'ouro - Parque das Nações"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Cidade / Concelho *</label>
                    <input
                      type="text"
                      required
                      value={newStore.cidade}
                      onChange={(e) => setNewStore({ ...newStore, cidade: e.target.value })}
                      placeholder="Ex: Lisboa"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Status Inicial</label>
                    <select
                      value={newStore.status}
                      onChange={(e) => setNewStore({ ...newStore, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    >
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Endereço Completo *</label>
                  <input
                    type="text"
                    required
                    value={newStore.endereco}
                    onChange={(e) => setNewStore({ ...newStore, endereco: e.target.value })}
                    placeholder="Ex: Rua Augusta 120, Baixa"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Gerente Responsável</label>
                    <input
                      type="text"
                      value={newStore.gerente}
                      onChange={(e) => setNewStore({ ...newStore, gerente: e.target.value })}
                      placeholder="Nome do gerente"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Telefone de Contacto</label>
                    <input
                      type="tel"
                      value={newStore.telefone}
                      onChange={(e) => setNewStore({ ...newStore, telefone: e.target.value })}
                      placeholder="+351 2XX XXX XXX"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Horário de Funcionamento</label>
                    <input
                      type="text"
                      value={newStore.horario}
                      onChange={(e) => setNewStore({ ...newStore, horario: e.target.value })}
                      placeholder="Seg - Sáb: 09:30 - 19:00"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Meta Mensal (€)</label>
                    <input
                      type="number"
                      step="1000"
                      value={newStore.metaMes}
                      onChange={(e) => setNewStore({ ...newStore, metaMes: parseFloat(e.target.value) || 30000 })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    Criar Balcão
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            7. MODAL: EDITAR LOJA
           ========================================================= */}
        {isEditModalOpen && editingStore && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsEditModalOpen(false)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[#D4AF37]" />
                  <span>Editar Balcão: {editingStore.codigo}</span>
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nome da Loja</label>
                  <input
                    type="text"
                    required
                    value={editingStore.nome}
                    onChange={(e) => setEditingStore({ ...editingStore, nome: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Cidade</label>
                    <input
                      type="text"
                      required
                      value={editingStore.cidade}
                      onChange={(e) => setEditingStore({ ...editingStore, cidade: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Estado</label>
                    <select
                      value={editingStore.status}
                      onChange={(e) => setEditingStore({ ...editingStore, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    >
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Endereço</label>
                  <input
                    type="text"
                    required
                    value={editingStore.endereco}
                    onChange={(e) => setEditingStore({ ...editingStore, endereco: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Gerente</label>
                    <input
                      type="text"
                      value={editingStore.gerente}
                      onChange={(e) => setEditingStore({ ...editingStore, gerente: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Telefone</label>
                    <input
                      type="tel"
                      value={editingStore.telefone}
                      onChange={(e) => setEditingStore({ ...editingStore, telefone: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Horário</label>
                    <input
                      type="text"
                      value={editingStore.horario}
                      onChange={(e) => setEditingStore({ ...editingStore, horario: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Meta Mensal (€)</label>
                    <input
                      type="number"
                      step="1000"
                      value={editingStore.metaMes}
                      onChange={(e) => {
                        const meta = parseFloat(e.target.value) || 1;
                        const progresso = Math.round((editingStore.volumeMes / meta) * 100);
                        setEditingStore({ ...editingStore, metaMes: meta, progressoMeta: progresso });
                      }}
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    Guardar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            8. MODAL: CONFIRMAÇÃO DE ELIMINAÇÃO
           ========================================================= */}
        {isDeletingId && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsDeletingId(null)}
          >
            <div
              className="bg-[#151b2b] border border-rose-900/50 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Eliminar Balcão?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Tem a certeza que deseja remover este balcão da lista ativa? Esta ação não pode ser revertida.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsDeletingId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteStore(isDeletingId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30"
                >
                  Confirmar Eliminação
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreManagement;
