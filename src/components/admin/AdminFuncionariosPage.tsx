// PATH: src/components/admin/AdminFuncionariosPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer, ToastMessage } from '../common/Toast';
import type { AdminFuncionario, AdminLoja, CreateFuncionarioDTO, UpdateFuncionarioDTO } from '../../types/admin';
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  Edit2,
  RefreshCw,
  Power,
  AlertTriangle,
  Loader2,
  X,
  UserCheck,
  UserX,
} from 'lucide-react';

interface AdminFuncionariosPageProps {
  onNavigate: (path: string) => void;
}

export const AdminFuncionariosPage: React.FC<AdminFuncionariosPageProps> = ({ onNavigate }) => {
  const [funcionarios, setFuncionarios] = useState<AdminFuncionario[]>([]);
  const [lojas, setLojas] = useState<AdminLoja[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLojaFilter, setSelectedLojaFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');

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

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<AdminFuncionario | null>(null);
  const [formData, setFormData] = useState<CreateFuncionarioDTO & { ativo: boolean }>({
    nome_completo: '',
    telemovel: '+351 ',
    loja_id: null,
    role: 'operador',
    email: '',
    ativo: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Modal Confirmação de Desativação
  const [deactivatingFunc, setDeactivatingFunc] = useState<AdminFuncionario | null>(null);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);

  // Normalização e validação de telemóvel português
  const validatePhone = (raw: string): { isValid: boolean; normalized?: string } => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 9 && digits.startsWith('9')) {
      return { isValid: true, normalized: `+351${digits}` };
    }
    if (digits.length === 12 && digits.startsWith('3519')) {
      return { isValid: true, normalized: `+${digits}` };
    }
    return { isValid: false };
  };

  // Carregar dados (Lojas e Funcionárias)
  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      let loadedLojas: AdminLoja[] = [];
      let loadedFuncs: AdminFuncionario[] = [];

      const token = sessionStorage.getItem('diamante_jwt_token');
      const headers = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // 1. Carregar Lojas
      try {
        const resLojas = await fetch('/api/admin/lojas', { headers, signal: AbortSignal.timeout(4000) });
        if (resLojas.ok) {
          const data = await resLojas.json();
          if (Array.isArray(data.lojas)) loadedLojas = data.lojas;
        }
      } catch {}

      if (loadedLojas.length === 0 && isSupabaseConfigured()) {
        const { data } = await supabase.from('lojas').select('*').order('nome', { ascending: true });
        if (data) loadedLojas = data as AdminLoja[];
      }
      setLojas(loadedLojas);

      // Mapa de lojas para associar nome
      const lojaMap = new Map<string, AdminLoja>();
      loadedLojas.forEach((l) => lojaMap.set(l.id, l));

      // 2. Carregar Funcionárias
      try {
        const resFuncs = await fetch('/api/admin/funcionarios', { headers, signal: AbortSignal.timeout(4000) });
        if (resFuncs.ok) {
          const data = await resFuncs.json();
          if (Array.isArray(data.funcionarios)) loadedFuncs = data.funcionarios;
        }
      } catch {}

      if (loadedFuncs.length === 0 && isSupabaseConfigured()) {
        const { data } = await supabase
          .from('funcionarios')
          .select('*, lojas(nome, codigo_loja)')
          .order('nome_completo', { ascending: true });

        if (data) {
          loadedFuncs = data.map((f: any) => ({
            ...f,
            loja_nome: f.lojas?.nome || (f.loja_id ? lojaMap.get(f.loja_id)?.nome : null),
            codigo_loja: f.lojas?.codigo_loja || (f.loja_id ? lojaMap.get(f.loja_id)?.codigo_loja : null),
          }));
        }
      }

      setFuncionarios(loadedFuncs);
    } catch (err: any) {
      console.warn('[AdminFuncionarios] Aviso ao carregar:', err?.message || err);
      addToast('error', 'Não foi possível atualizar a lista de funcionárias.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtragem
  const filteredFuncionarios = useMemo(() => {
    return funcionarios.filter((func) => {
      // Filtro por Loja
      if (selectedLojaFilter !== 'todos') {
        if (func.loja_id !== selectedLojaFilter) return false;
      }

      // Filtro por Estado
      if (statusFilter === 'ativo' && func.ativo === false) return false;
      if (statusFilter === 'inativo' && func.ativo !== false) return false;

      // Pesquisa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = func.nome_completo?.toLowerCase().includes(q);
        const matchPhone = func.telemovel?.toLowerCase().includes(q);
        const matchEmail = func.email?.toLowerCase().includes(q);
        const matchLoja = func.loja_nome?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchLoja) return false;
      }

      return true;
    });
  }, [funcionarios, selectedLojaFilter, statusFilter, searchQuery]);

  // Contadores
  const totalFuncionarios = funcionarios.length;
  const ativasCount = funcionarios.filter((f) => f.ativo !== false).length;
  const lojasComOperadorCount = new Set(
    funcionarios.filter((f) => f.ativo !== false && f.loja_id).map((f) => f.loja_id)
  ).size;

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    setEditingFuncionario(null);
    setFormData({
      nome_completo: '',
      telemovel: '+351 ',
      loja_id: lojas.length > 0 ? lojas[0].id : null,
      role: 'operador',
      email: '',
      ativo: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (func: AdminFuncionario) => {
    setEditingFuncionario(func);
    setFormData({
      nome_completo: func.nome_completo || '',
      telemovel: func.telemovel || '+351 ',
      loja_id: func.loja_id || null,
      role: func.role || 'operador',
      email: func.email || '',
      ativo: func.ativo !== false,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Submissão de Criação / Edição
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.nome_completo.trim()) {
      errors.nome_completo = 'Nome completo é obrigatório.';
    }

    const phoneCheck = validatePhone(formData.telemovel);
    if (!phoneCheck.isValid || !phoneCheck.normalized) {
      errors.telemovel = 'Número de telemóvel inválido (deve ser português: 9 dígitos começados por 9).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        ...formData,
        telemovel: phoneCheck.normalized,
      };

      if (editingFuncionario) {
        // PUT /admin/funcionarios/:id
        const res = await fetch(`/api/admin/funcionarios/${editingFuncionario.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.message || 'Falha ao atualizar funcionária.');
        }

        addToast('success', `Registo de "${formData.nome_completo}" atualizado com sucesso.`, 'Funcionária Guardada');
      } else {
        // POST /admin/funcionarios
        const res = await fetch('/api/admin/funcionarios', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.message || 'Falha ao registar funcionária.');
        }

        addToast('success', `Funcionária "${formData.nome_completo}" registada no sistema.`, 'Registo Concluído');
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.warn('[AdminFuncionarios] Erro:', err?.message || err);
      addToast('error', err?.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Estado Ativo / Inativo
  const handleToggleStatus = (func: AdminFuncionario) => {
    if (func.ativo !== false) {
      // Se está ativa, pede confirmação obrigatória antes de desativar
      setDeactivatingFunc(func);
    } else {
      // Se está inativa, reativa diretamente
      executeToggleStatus(func, true);
    }
  };

  const executeToggleStatus = async (func: AdminFuncionario, newStatus: boolean) => {
    try {
      const token = sessionStorage.getItem('diamante_jwt_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`/api/admin/funcionarios/${func.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ativo: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Falha ao alterar estado da conta.');
      }

      addToast(
        newStatus ? 'success' : 'info',
        `Conta de ${func.nome_completo} marcada como ${newStatus ? 'Ativa' : 'Inativa'}.`,
        'Estado Atualizado'
      );
      setDeactivatingFunc(null);
      await fetchData();
    } catch (err: any) {
      addToast('error', err?.message || 'Erro ao atualizar estado.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Menu Lateral Admin */}
      <AdminSidebar currentPath="/admin/funcionarios" onNavigate={onNavigate} />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Cabeçalho */}
        <header className="sticky top-0 z-30 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#D4AF37]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Gestão de Recursos Humanos & Balcões
                  </h1>
                  <p className="text-xs text-slate-400">
                    Atribuição de operadores, autenticação OTP WhatsApp e controlo de acessos
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchData()}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Sincronizar Funcionárias"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
              </button>

              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Registar Funcionária</span>
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Cartões de Indicadores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Total Funcionárias
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {totalFuncionarios}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700/50">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                  Operadoras Ativas
                </p>
                <p className="text-2xl font-bold text-emerald-300 mt-1">
                  {ativasCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37]">
                  Lojas com Atribuição
                </p>
                <p className="text-2xl font-bold text-amber-200 mt-1">
                  {lojasComOperadorCount} <span className="text-xs text-slate-400 font-normal">/ {lojas.length}</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#D4AF37]">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Barra de Filtros: Filtro por Loja + Pesquisa + Estado */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1 max-w-2xl">
              {/* Barra de Pesquisa */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por nome, telemóvel (+351) ou email..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37]/60"
                />
              </div>

              {/* Dropdown de Filtro por Loja */}
              <div className="w-full sm:w-64 shrink-0">
                <select
                  value={selectedLojaFilter}
                  onChange={(e) => setSelectedLojaFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-[#D4AF37]/60 cursor-pointer"
                >
                  <option value="todos">Todas as Lojas ({lojas.length})</option>
                  {lojas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codigo_loja} - {l.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle de Estado */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <span className="text-xs text-slate-400 font-mono">Estado:</span>
              <div className="flex items-center p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
                {(['todos', 'ativo', 'inativo'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setStatusFilter(opt)}
                    className={`px-3 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                      statusFilter === opt
                        ? 'bg-[#D4AF37] text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela de Funcionárias */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nome Completo</th>
                    <th className="py-3 px-4">Telemóvel (WhatsApp)</th>
                    <th className="py-3 px-4">Balcão Atribuído</th>
                    <th className="py-3 px-4">Perfil / Role</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                          <span className="font-mono text-xs">A carregar registos de funcionárias...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredFuncionarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 text-slate-400 stroke-1" />
                          <p className="font-semibold text-slate-300">Nenhuma funcionária encontrada</p>
                          <p className="text-[11px] text-slate-400">
                            Ajuste os filtros ou registe novas operadoras para os balcões.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFuncionarios.map((func) => {
                      const isAtivo = func.ativo !== false;
                      const isAdmin = func.role === 'admin' || func.role === 'master';

                      return (
                        <tr
                          key={func.id}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Nome */}
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{func.nome_completo}</span>
                              {isAdmin && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-[#D4AF37] border border-amber-500/30 font-mono">
                                  Master
                                </span>
                              )}
                            </div>
                            {func.email && (
                              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                <Mail className="w-2.5 h-2.5" />
                                <span>{func.email}</span>
                              </p>
                            )}
                          </td>

                          {/* Telemóvel */}
                          <td className="py-3.5 px-4 font-mono font-medium text-[#D4AF37]">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{func.telemovel}</span>
                            </div>
                          </td>

                          {/* Loja */}
                          <td className="py-3.5 px-4">
                            {func.loja_nome ? (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-200">
                                  {func.loja_nome}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Sede Central / Sem loja fixa
                              </span>
                            )}
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-mono capitalize ${
                                isAdmin
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : func.role === 'gerente'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              <Shield className="w-3 h-3 opacity-70" />
                              <span>{func.role || 'Operador'}</span>
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleStatus(func)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${
                                isAtivo
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                              }`}
                              title={isAtivo ? 'Clique para desativar' : 'Clique para ativar'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isAtivo ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                              {isAtivo ? 'Ativa' : 'Inativa'}
                            </button>
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(func)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 border border-slate-700 text-slate-200 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors cursor-pointer text-xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal Criar / Editar Funcionária */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative my-8">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#D4AF37]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingFuncionario ? 'Editar Funcionária' : 'Registar Nova Funcionária'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acesso via OTP WhatsApp com base no número de telemóvel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nome Completo */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  placeholder="Maria Silva Santos"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37]"
                  required
                />
                {formErrors.nome_completo && (
                  <p className="text-[10px] text-rose-400 mt-1">{formErrors.nome_completo}</p>
                )}
              </div>

              {/* Telemóvel */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Número de Telemóvel Português (+351) *
                </label>
                <input
                  type="tel"
                  value={formData.telemovel}
                  onChange={(e) => setFormData({ ...formData, telemovel: e.target.value })}
                  placeholder="+351 9XX XXX XXX"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Normalizado automaticamente para +351XXXXXXXXX. Deve ser único no sistema.
                </p>
                {formErrors.telemovel && (
                  <p className="text-[10px] text-rose-400 mt-1">{formErrors.telemovel}</p>
                )}
              </div>

              {/* Atribuição de Loja */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Balcão de Compra Atribuído
                </label>
                <select
                  value={formData.loja_id || ''}
                  onChange={(e) => setFormData({ ...formData, loja_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="">Sem balcão fixo / Sede Central</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.codigo_loja} - {loja.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Perfil / Role */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Perfil de Acesso (Role) *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="operador">Operador de Balcão (Compra e Ponto)</option>
                  <option value="gerente">Gerente de Loja (Aprovações Locais)</option>
                  <option value="admin">Administrador Master (Acesso Total)</option>
                </select>
              </div>

              {/* Email Opcional */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Email (Opcional)
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="operadora@diamantedouro.pt"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37]"
                />
              </div>

              {/* Estado Ativo Toggle */}
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <div>
                  <p className="text-xs font-semibold text-white">Estado da Conta</p>
                  <p className="text-[10px] text-slate-400">
                    Contas inativas não recebem código OTP nem acedem ao sistema
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                </label>
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>A guardar...</span>
                    </>
                  ) : (
                    <span>{editingFuncionario ? 'Atualizar Registo' : 'Criar Funcionária'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Desativação */}
      {deactivatingFunc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-rose-900/60 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-2">
              Desativar Utilizadora?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Tem a certeza que deseja desativar a funcionária{' '}
              <span className="font-semibold text-white">
                "{deactivatingFunc.nome_completo}"
              </span>
              ? O envio de códigos OTP via WhatsApp será imediatamente bloqueado.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeactivatingFunc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeToggleStatus(deactivatingFunc, false)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition-colors cursor-pointer"
              >
                Confirmar Desativação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
