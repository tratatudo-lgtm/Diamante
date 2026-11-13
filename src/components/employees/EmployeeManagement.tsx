// PATH: src/components/employees/EmployeeManagement.tsx
import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  Shield,
  Clock,
  Calendar,
  Euro,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  UserCheck,
  UserX,
  CreditCard,
  Filter,
  Sparkles,
  ArrowUpDown,
  MoreVertical,
} from 'lucide-react';
import { useEmployees, useStores } from '../../hooks/useSupabaseData';

export type EmployeeRole = 'Gerente' | 'Operador' | 'Estagiário' | '';
export type EmployeeStatus = 'em_servico' | 'ausente' | 'ferias' | '';

export interface Employee {
  id: string;
  codigo: string;
  nome: string;
  nif: string;
  telemovel: string;
  email: string;
  lojaId: string;
  lojaNome: string;
  cargo: EmployeeRole;
  salarioBase: number;
  dataAdmissao: string;
  status: EmployeeStatus;
  avatarColor: string;
  especialidade?: string;
  transacoesMes?: number;
}

export const EmployeeManagement: React.FC = () => {
  const { data: employees, loading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: stores } = useStores();
  const storeOptions = stores.map((store) => ({ id: store.id, nome: store.nome }));

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | EmployeeRole>('Todos');
  const [storeFilter, setStoreFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | EmployeeStatus>('todos');

  // Modais
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Form State (para criar ou editar)
  const [formData, setFormData] = useState<Omit<Employee, 'id' | 'codigo' | 'avatarColor'>>({
    nome: '',
    nif: '',
    telemovel: '+351 ',
    email: '',
    lojaId: '',
    lojaNome: '',
    cargo: 'Operador',
    salarioBase: 0,
    dataAdmissao: new Date().toLocaleDateString('pt-PT'),
    status: 'em_servico',
    especialidade: '',
  });

  // 1. Estatísticas Calculadas
  const totalEmployees = employees.length;
  const activeNow = useMemo(
    () => employees.filter((e) => e.status === 'em_servico').length,
    [employees]
  );

  // Lojas com equipe completa (lojas que possuem pelo menos 1 Gerente e 1 Operador/Estagiário)
  const storesWithCompleteTeam = useMemo(() => {
    const storeEmployeeMap = new Map<string, Set<EmployeeRole>>();
    employees.forEach((emp) => {
      if (emp.status === 'em_servico') {
        const set = storeEmployeeMap.get(emp.lojaId) || new Set<EmployeeRole>();
        set.add(emp.cargo);
        storeEmployeeMap.set(emp.lojaId, set);
      }
    });

    let completeCount = 0;
    storeEmployeeMap.forEach((roles) => {
      if (roles.has('Gerente') && (roles.has('Operador') || roles.has('Estagiário'))) {
        completeCount++;
      }
    });
    return completeCount;
  }, [employees]);

  // 2. Filtragem de Colaboradores
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Filtro por Cargo
      if (roleFilter !== 'Todos' && emp.cargo !== roleFilter) {
        return false;
      }

      // Filtro por Loja
      if (storeFilter !== 'todas' && emp.lojaId !== storeFilter) {
        return false;
      }

      // Filtro por Status
      if (statusFilter !== 'todos' && emp.status !== statusFilter) {
        return false;
      }

      // Pesquisa por Texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchNome = emp.nome.toLowerCase().includes(query);
        const matchNif = emp.nif.includes(query);
        const matchTelefone = emp.telemovel.toLowerCase().includes(query);
        const matchEmail = emp.email.toLowerCase().includes(query);
        const matchLoja = emp.lojaNome.toLowerCase().includes(query);
        const matchCodigo = emp.codigo.toLowerCase().includes(query);
        const matchCargo = emp.cargo.toLowerCase().includes(query);

        if (
          !matchNome &&
          !matchNif &&
          !matchTelefone &&
          !matchEmail &&
          !matchLoja &&
          !matchCodigo &&
          !matchCargo
        ) {
          return false;
        }
      }

      return true;
    });
  }, [employees, roleFilter, storeFilter, statusFilter, searchTerm]);

  // Formatação de Valores Monetários
  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Obter Iniciais do Nome
  const getInitials = (nome: string) => {
    const parts = nome.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nome.slice(0, 2).toUpperCase();
  };

  // Helper de Badge de Status
  const renderStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case 'em_servico':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Em Serviço
          </span>
        );
      case 'ausente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Ausente / Folga
          </span>
        );
      case 'ferias':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Férias
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-400">Não definido</span>;
    }
  };

  // Helper de Badge de Cargo
  const renderRoleBadge = (cargo: EmployeeRole) => {
    switch (cargo) {
      case 'Gerente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
            <Shield className="w-3 h-3" />
            Gerente
          </span>
        );
      case 'Operador':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Briefcase className="w-3 h-3" />
            Operador
          </span>
        );
      case 'Estagiário':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Estagiário
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-400">Não definido</span>;
    }
  };

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    setFormData({
      nome: '',
      nif: '',
      telemovel: '+351 ',
      email: '',
      lojaId: storeOptions[0]?.id || '',
      lojaNome: storeOptions[0]?.nome || '',
      cargo: 'Operador',
      salarioBase: 0,
      dataAdmissao: new Date().toLocaleDateString('pt-PT'),
      status: 'em_servico',
      especialidade: '',
    });
    setIsCreateModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormData({
      nome: emp.nome,
      nif: emp.nif,
      telemovel: emp.telemovel,
      email: emp.email,
      lojaId: emp.lojaId,
      lojaNome: emp.lojaNome,
      cargo: emp.cargo,
      salarioBase: emp.salarioBase,
      dataAdmissao: emp.dataAdmissao,
      status: emp.status,
      especialidade: emp.especialidade || '',
    });
    setIsEditModalOpen(true);
  };

  // Submeter Novo Funcionário (Supabase)
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.nif.trim()) return;
    const storeObj = storeOptions.find((store) => store.id === formData.lojaId);
    try {
      await createEmployee({ ...formData, lojaNome: storeObj?.nome || '', transacoesMes: 0 });
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao criar o funcionário.');
    }
  };

  // Submeter Edição (Supabase)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    const storeObj = storeOptions.find((store) => store.id === formData.lojaId);
    const updated: Partial<Employee> = { ...formData, lojaNome: storeObj?.nome || '' };
    try {
      await updateEmployee(selectedEmployee.id, updated);
      setSelectedEmployee({ ...selectedEmployee, ...updated });
      setIsEditModalOpen(false);
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao atualizar o funcionário.');
    }
  };

  // Eliminar Funcionário (Supabase)
  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteEmployee(id);
      setIsDeletingId(null);
      setSelectedEmployee(null);
    } catch (err: any) {
      setActionError(err?.message || 'Falha ao eliminar o funcionário.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#D4AF37]/30 selection:text-white">
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
                  Equipa & Funcionários
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Recursos Humanos, Alocação às Lojas e Gestão de Escalas
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Funcionário</span>
          </button>
        </header>

        {/* =========================================================
            2. STATS CARDS DO TOPO
           ========================================================= */}
        <section
          aria-label="Indicadores da Equipa"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6"
        >
          {/* Card 1: Total Colaboradores */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Total Colaboradores
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                {totalEmployees}
              </p>
              <p className="text-[11px] text-[#D4AF37] font-medium">
                Registos carregados da base de dados
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Em Serviço Agora */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Em Serviço Agora
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                  {activeNow}
                </p>
                <span className="text-xs font-mono text-slate-400">
                  / {totalEmployees} operacionais
                </span>
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {totalEmployees > 0 ? `${Math.round((activeNow / totalEmployees) * 100)}% de taxa de presença` : 'Sem dados de presença'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Lojas com Equipa Completa */}
          <div className="p-5 rounded-2xl bg-[#151b2b] border border-slate-800/80 shadow-xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-colors">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Lojas com Equipa Completa
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {storesWithCompleteTeam}
                </p>
                <span className="text-xs font-mono text-slate-400">
                  / {stores.length} lojas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Gerente + Operador em escala ativa
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* =========================================================
            3. BARRA DE PESQUISA & FILTROS RÁPIDOS (Pills)
           ========================================================= */}
        <section
          aria-label="Filtros e Pesquisa"
          className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-4"
        >
          {/* Linha 1: Pesquisa + Filtro de Loja Dropdown */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome, NIF, telemóvel (+351), loja ou cargo..."
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

            {/* Dropdown de Filtro por Loja */}
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

          {/* Linha 2: Filtros Pill por Cargo e Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {/* Cargo Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Cargo:
              </span>
              {(['Todos', 'Gerente', 'Operador', 'Estagiário'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    roleFilter === r
                      ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md shadow-[#D4AF37]/20'
                      : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                Estado:
              </span>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'todos'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('em_servico')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'em_servico'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                Em Serviço ({activeNow})
              </button>
              <button
                onClick={() => setStatusFilter('ausente')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'ausente'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-amber-400 border border-slate-800'
                }`}
              >
                Ausentes
              </button>
              <button
                onClick={() => setStatusFilter('ferias')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'ferias'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-sky-400 border border-slate-800'
                }`}
              >
                Férias
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================
            4. LISTA / TABELA RESPONSIVA
           ========================================================= */}
        <section aria-label="Lista de Colaboradores">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#151b2b] border border-slate-800 space-y-3">
              <Users className="w-12 h-12 text-slate-400 mx-auto stroke-1" />
              <p className="text-base font-bold text-white">
                Nenhum colaborador encontrado
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não existem colaboradores com os critérios de pesquisa ou filtros selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('Todos');
                  setStoreFilter('todas');
                  setStatusFilter('todos');
                }}
                className="text-xs text-[#D4AF37] hover:underline font-mono pt-2 cursor-pointer"
              >
                Limpar todos os filtros
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
                        <th className="py-3.5 px-4">Colaborador</th>
                        <th className="py-3.5 px-4">NIF</th>
                        <th className="py-3.5 px-4">Telemóvel</th>
                        <th className="py-3.5 px-4">Balcão Alocado</th>
                        <th className="py-3.5 px-4">Cargo</th>
                        <th className="py-3.5 px-4 font-right">Salário Base</th>
                        <th className="py-3.5 px-4">Estado</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedEmployee(emp)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Colaborador (Avatar + Nome + Código) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${emp.avatarColor} text-slate-950 font-bold flex items-center justify-center text-xs shadow-md shrink-0`}
                              >
                                {getInitials(emp.nome)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors truncate">
                                  {emp.nome}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {emp.codigo} &bull; {emp.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* NIF */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {emp.nif}
                          </td>

                          {/* Telemóvel */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{emp.telemovel}</span>
                            </div>
                          </td>

                          {/* Loja */}
                          <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-300" title={emp.lojaNome}>
                            <div className="flex items-center gap-1.5 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{emp.lojaNome}</span>
                            </div>
                          </td>

                          {/* Cargo */}
                          <td className="py-3.5 px-4">
                            {renderRoleBadge(emp.cargo)}
                          </td>

                          {/* Salário Base */}
                          <td className="py-3.5 px-4 font-mono font-medium text-white">
                            {formatEUR(emp.salarioBase)}
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(emp.status)}
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(emp);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 text-slate-300 hover:text-[#D4AF37] transition-colors"
                                title="Editar Colaborador"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE VIEW: Cards Verticais Elegantes (Visível em <md) */}
              <div className="md:hidden space-y-3">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="p-4 rounded-2xl bg-[#151b2b] border border-slate-800 shadow-lg space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {/* Header do Card Mobile */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${emp.avatarColor} text-slate-950 font-bold flex items-center justify-center text-xs shadow-md shrink-0`}
                        >
                          {getInitials(emp.nome)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">
                            {emp.nome}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {emp.codigo} &bull; {emp.nif}
                          </p>
                        </div>
                      </div>

                      {renderStatusBadge(emp.status)}
                    </div>

                    {/* Informações Centrais */}
                    <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Cargo:</span>
                        {renderRoleBadge(emp.cargo)}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Balcão:</span>
                        <span className="truncate max-w-[190px] text-right font-medium text-white">
                          {emp.lojaNome.replace("Diamante D'ouro - ", "")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Contacto:</span>
                        <span className="font-mono text-slate-200">{emp.telemovel}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Salário Base:</span>
                        <span className="font-mono font-bold text-white">
                          {formatEUR(emp.salarioBase)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            5. MODAL DE DETALHES DO COLABORADOR
           ========================================================= */}
        {selectedEmployee && !isEditModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedEmployee(null)}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="p-6 border-b border-slate-800 bg-[#0b0f19] flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${selectedEmployee.avatarColor} text-slate-950 font-bold flex items-center justify-center text-sm shadow-md shrink-0`}
                  >
                    {getInitials(selectedEmployee.nome)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-amber-500/10 border border-[#D4AF37]/30">
                        {selectedEmployee.codigo}
                      </span>
                      {renderStatusBadge(selectedEmployee.status)}
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">
                      {selectedEmployee.nome}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informação Completa */}
              <div className="p-6 space-y-5 text-xs text-slate-300">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Cargo</p>
                    <p className="font-bold text-white text-sm mt-0.5">
                      {selectedEmployee.cargo}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Vencimento Base</p>
                    <p className="font-bold text-emerald-400 font-mono text-sm mt-0.5">
                      {formatEUR(selectedEmployee.salarioBase)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Data Admissão</p>
                    <p className="font-bold text-slate-200 font-mono text-sm mt-0.5">
                      {selectedEmployee.dataAdmissao}
                    </p>
                  </div>
                </div>

                {/* Detalhes de Contacto e Balcão */}
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Balcão de Atribuição & Especialidade</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>
                      <span className="text-slate-400">Loja Alocada:</span>{' '}
                      <strong className="text-white">{selectedEmployee.lojaNome}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Especialidade / Foco:</span>{' '}
                      <span className="text-[#D4AF37]">
                        {selectedEmployee.especialidade || 'Avaliação Geral de Metais Preciosos'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">Transações este Mês:</span>{' '}
                      <strong className="font-mono text-white">
                        {selectedEmployee.transacoesMes || 0} compras registadas
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0b0f19] border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                    <span>Dados Fiscais & Contactos Pessoais</span>
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>
                      <span className="text-slate-400">NIF:</span>{' '}
                      <strong className="font-mono text-white">{selectedEmployee.nif}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Telemóvel (WhatsApp):</span>{' '}
                      <span className="font-mono text-white">{selectedEmployee.telemovel}</span>
                    </p>
                    <p>
                      <span className="text-slate-400">Email Corporativo:</span>{' '}
                      <span className="text-slate-200">{selectedEmployee.email}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Ações do Rodapé */}
              <div className="p-5 border-t border-slate-800 bg-[#0b0f19] flex items-center justify-between gap-3">
                <button
                  onClick={() => setIsDeletingId(selectedEmployee.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(selectedEmployee)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Editar Dados</span>
                  </button>

                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Concluído
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            6. MODAL: EDITAR / NOVO FUNCIONÁRIO (Formulário Completo)
           ========================================================= */}
        {(isCreateModalOpen || isEditModalOpen) && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => {
              setIsCreateModalOpen(false);
              setIsEditModalOpen(false);
            }}
          >
            <div
              className="bg-[#151b2b] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-800 bg-[#0b0f19] flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {isCreateModalOpen ? (
                    <>
                      <Plus className="w-5 h-5 text-[#D4AF37]" />
                      <span>Registar Novo Funcionário</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-5 h-5 text-[#D4AF37]" />
                      <span>Editar Colaborador ({selectedEmployee?.codigo})</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={isCreateModalOpen ? handleSaveCreate : handleSaveEdit}
                className="p-6 space-y-4 text-xs"
              >
                {/* Nome Completo */}
                <div>
                  <label className="block text-slate-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Ana Sofia Martins"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 mb-1">NIF (9 Dígitos) *</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      placeholder="234567891"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Telemóvel */}
                  <div>
                    <label className="block text-slate-400 mb-1">Telemóvel (+351) *</label>
                    <input
                      type="tel"
                      required
                      value={formData.telemovel}
                      onChange={(e) => setFormData({ ...formData, telemovel: e.target.value })}
                      placeholder="+351 9XX XXX XXX"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Loja de Alocação */}
                <div>
                  <label className="block text-slate-400 mb-1">Balcão de Alocação *</label>
                  <select
                    value={formData.lojaId}
                    onChange={(e) => {
                      const sel = storeOptions.find((s) => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        lojaId: e.target.value,
                        lojaNome: sel ? sel.nome : formData.lojaNome,
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                  >
                    {storeOptions.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Cargo */}
                  <div>
                    <label className="block text-slate-400 mb-1">Cargo *</label>
                    <select
                      value={formData.cargo}
                      onChange={(e) =>
                        setFormData({ ...formData, cargo: e.target.value as EmployeeRole })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="Gerente">Gerente</option>
                      <option value="Operador">Operador</option>
                      <option value="Estagiário">Estagiário</option>
                    </select>
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="block text-slate-400 mb-1">Estado Operacional</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as EmployeeStatus })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="em_servico">Em Serviço</option>
                      <option value="ausente">Ausente / Folga</option>
                      <option value="ferias">Férias</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Salário Base */}
                  <div>
                    <label className="block text-slate-400 mb-1">Salário Base (€)</label>
                    <input
                      type="number"
                      step="50"
                      value={formData.salarioBase}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          salarioBase: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Data de Admissão */}
                  <div>
                    <label className="block text-slate-400 mb-1">Data de Admissão</label>
                    <input
                      type="text"
                      value={formData.dataAdmissao}
                      onChange={(e) =>
                        setFormData({ ...formData, dataAdmissao: e.target.value })
                      }
                      placeholder="DD/MM/AAAA"
                      className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Email Corporativo */}
                <div>
                  <label className="block text-slate-400 mb-1">Email Corporativo</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nome.sobrenome@diamantedouro.pt"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Especialidade */}
                <div>
                  <label className="block text-slate-400 mb-1">Especialidade / Peritagem</label>
                  <input
                    type="text"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                    placeholder="Ex: Joalharia Antiga, Diamantes, Ouro Toque 800"
                    className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setIsEditModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold"
                  >
                    {isCreateModalOpen ? 'Registar Funcionário' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            7. MODAL DE CONFIRMAÇÃO DE ELIMINAÇÃO
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
                <h4 className="text-base font-bold text-white">Eliminar Colaborador?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Tem a certeza que deseja remover este registo de funcionário da rede? Esta ação é irreversível.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsDeletingId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteEmployee(isDeletingId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 cursor-pointer"
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

export default EmployeeManagement;
