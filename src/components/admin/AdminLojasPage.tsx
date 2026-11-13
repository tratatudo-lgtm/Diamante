// PATH: src/components/admin/AdminLojasPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { ToastContainer, ToastMessage } from '../common/Toast';
import type { AdminLoja, CreateLojaDTO, UpdateLojaDTO } from '../../types/admin';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  Hash,
  FileText,
  CheckCircle2,
  XCircle,
  Edit2,
  RefreshCw,
  ExternalLink,
  Navigation,
  Globe,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';

interface AdminLojasPageProps {
  onNavigate: (path: string) => void;
}

export const AdminLojasPage: React.FC<AdminLojasPageProps> = ({ onNavigate }) => {
  const [lojas, setLojas] = useState<AdminLoja[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoja, setEditingLoja] = useState<AdminLoja | null>(null);
  const [formData, setFormData] = useState<CreateLojaDTO & { ativo: boolean }>({
    nome: '',
    codigo_loja: '',
    morada: '',
    nif_loja: '',
    telefone: '',
    ativo: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocodingPreview, setIsGeocodingPreview] = useState(false);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Validação algorítmica de NIF Português no frontend
  const validateNIF = (nif: string): boolean => {
    const clean = nif.trim();
    if (!/^\d{9}$/.test(clean)) return false;
    const first = clean.charAt(0);
    if (!['1', '2', '3', '5', '6', '8', '9'].includes(first)) return false;
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(clean.charAt(i), 10) * (9 - i);
    }
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? 0 : 11 - remainder;
    return parseInt(clean.charAt(8), 10) === checkDigit;
  };

  // Carregar lojas exclusivamente através da API administrativa protegida.
  const fetchLojas = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const token = sessionStorage.getItem('diamante_jwt_token');
      if (!token) throw new Error('Sessão administrativa não encontrada.');

      const res = await fetch('/api/admin/lojas', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !Array.isArray(data?.lojas)) {
        throw new Error('Não foi possível carregar as lojas através da API protegida.');
      }

      setLojas(data.lojas as AdminLoja[]);
      return true;
    } catch {
      console.warn('[AdminLojas] Falha ao carregar lojas pela API protegida.');
      addToast('error', 'Não foi possível atualizar a lista de lojas. Verifique a sessão e tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLojas();
  }, [fetchLojas]);

  // Filtragem
  const filteredLojas = useMemo(() => {
    return lojas.filter((loja) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = loja.nome?.toLowerCase().includes(q);
        const matchCode = loja.codigo_loja?.toLowerCase().includes(q);
        const matchMorada = loja.morada?.toLowerCase().includes(q);
        const matchNif = loja.nif_loja?.includes(q);
        if (!matchName && !matchCode && !matchMorada && !matchNif) return false;
      }
      if (statusFilter === 'ativo' && loja.ativo === false) return false;
      if (statusFilter === 'inativo' && loja.ativo !== false) return false;
      return true;
    });
  }, [lojas, searchQuery, statusFilter]);

  // Contadores
  const totalLojas = lojas.length;
  const ativasCount = lojas.filter((l) => l.ativo !== false).length;
  const geocodedCount = lojas.filter((l) => l.latitude !== null && l.longitude !== null).length;

  // Abrir Modal para Criar
  const handleOpenCreate = () => {
    setEditingLoja(null);
    const nextCode = `LOJ-${String(totalLojas + 1).padStart(3, '0')}`;
    setFormData({
      nome: '',
      codigo_loja: nextCode,
      morada: '',
      nif_loja: '',
      telefone: '',
      ativo: true,
    });
    setPreviewCoords(null);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleOpenEdit = (loja: AdminLoja) => {
    setEditingLoja(loja);
    setFormData({
      nome: loja.nome || '',
      codigo_loja: loja.codigo_loja || '',
      morada: loja.morada || '',
      nif_loja: loja.nif_loja || '',
      telefone: loja.telefone || '',
      ativo: loja.ativo !== false,
    });
    if (loja.latitude && loja.longitude) {
      setPreviewCoords({ lat: loja.latitude, lng: loja.longitude });
    } else {
      setPreviewCoords(null);
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Testar geocodificação da morada via Nominatim OpenStreetMap
  const handleTestGeocoding = async () => {
    if (!formData.morada.trim()) {
      setFormErrors((prev) => ({ ...prev, morada: 'Introduza uma morada para geocodificar.' }));
      return;
    }

    setIsGeocodingPreview(true);
    try {
      const query = `${formData.morada.trim()}, Portugal`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-PT,pt;q=0.9',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setPreviewCoords({ lat, lng });
          addToast('success', `Coordenadas localizadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'Geocodificação Sucesso');
          return;
        }
      }
      addToast('info', 'Morada não localizada automaticamente no mapa. O backend tentará refinar na gravação.');
    } catch {
      addToast('info', 'Geocodificação prévia em standby. Será processada ao guardar.');
    } finally {
      setIsGeocodingPreview(false);
    }
  };

  // Validação e Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.nome.trim()) errors.nome = 'Nome da loja é obrigatório.';
    if (!formData.codigo_loja.trim()) errors.codigo_loja = 'Código da loja é obrigatório.';
    if (!formData.morada.trim()) errors.morada = 'Morada completa é obrigatória.';

    if (!formData.nif_loja.trim()) {
      errors.nif_loja = 'O NIF é obrigatório para registar uma loja.';
    } else {
      if (!validateNIF(formData.nif_loja)) {
        errors.nif_loja = 'NIF inválido (deve conter 9 dígitos com dígito de controlo correto).';
      }
    }

    const cleanPhone = formData.telefone.replace(/\D/g, '');
    if (cleanPhone) {
      if (!cleanPhone.startsWith('9') && !cleanPhone.startsWith('3519') && !cleanPhone.startsWith('2') && !cleanPhone.startsWith('3512')) {
        errors.telefone = 'Contacto de telefone português inválido.';
      }
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

      if (editingLoja) {
        // PUT /admin/lojas/:id
        const res = await fetch(`/api/admin/lojas/${editingLoja.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || 'Falha ao atualizar loja.');
        }

      } else {
        // POST /admin/lojas
        const res = await fetch('/api/admin/lojas', {
          method: 'POST',
          headers,
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || 'Falha ao criar loja.');
        }

      }

      setIsModalOpen(false);
      const synchronized = await fetchLojas();
      if (synchronized) {
        addToast('success', `Loja "${formData.nome}" ${editingLoja ? 'atualizada' : 'criada'} com sucesso.`, editingLoja ? 'Loja Guardada' : 'Loja Criada');
      } else {
        addToast('info', 'A gravação foi concluída, mas a lista não sincronizou. Atualize a página antes de repetir a operação.');
      }
    } catch (err: any) {
      console.warn('[AdminLojas] Falha ao gravar loja.');
      addToast('error', 'Não foi possível gravar a loja. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Menu Lateral Admin */}
      <AdminSidebar currentPath="/admin/lojas" onNavigate={onNavigate} />

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Cabeçalho da Página */}
        <header className="sticky top-0 z-30 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#D4AF37]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Gestão de Lojas & Balcões
                  </h1>
                  <p className="text-xs text-slate-400">
                    Rede física "Diamante D'ouro" &bull; Controlo de moradas e georreferenciação
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchLojas()}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Sincronizar Lojas"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
              </button>

              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nova Loja</span>
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo com Métricas e Tabela */}
        <main className="p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Cartões de Indicadores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Total de Balcões
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {totalLojas}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700/50">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                  Balcões Ativos
                </p>
                <p className="text-2xl font-bold text-emerald-300 mt-1">
                  {ativasCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37]">
                  Geolocalizadas (GPS)
                </p>
                <p className="text-2xl font-bold text-amber-200 mt-1">
                  {geocodedCount} <span className="text-xs text-slate-400 font-normal">/ {totalLojas}</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#D4AF37]">
                <Navigation className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Barra de Filtros e Pesquisa */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por nome, código, morada ou NIF..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#D4AF37]/60"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
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

          {/* Tabela de Lojas */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Nome da Loja</th>
                    <th className="py-3 px-4">Morada Oficial</th>
                    <th className="py-3 px-4">NIF Loja</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Coordenadas</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                          <span className="font-mono text-xs">A carregar lojas da rede...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLojas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 className="w-8 h-8 text-slate-400 stroke-1" />
                          <p className="font-semibold text-slate-300">Nenhuma loja encontrada</p>
                          <p className="text-[11px] text-slate-400">
                            Ajuste os filtros ou utilize o botão "+ Nova Loja" para registar balcões.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLojas.map((loja) => {
                      const isAtivo = loja.ativo !== false;
                      const hasCoords = loja.latitude !== null && loja.longitude !== null;

                      return (
                        <tr
                          key={loja.id}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Código */}
                          <td className="py-3.5 px-4 font-mono font-bold text-[#D4AF37]">
                            {loja.codigo_loja || 'N/D'}
                          </td>

                          {/* Nome */}
                          <td className="py-3.5 px-4 font-semibold text-white">
                            {loja.nome}
                          </td>

                          {/* Morada */}
                          <td className="py-3.5 px-4 max-w-xs truncate text-slate-300" title={loja.morada}>
                            {loja.morada || 'Sem morada registada'}
                          </td>

                          {/* NIF */}
                          <td className="py-3.5 px-4 font-mono text-slate-400">
                            {loja.nif_loja || '—'}
                          </td>

                          {/* Telefone */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {loja.telefone || '—'}
                          </td>

                          {/* Coordenadas */}
                          <td className="py-3.5 px-4">
                            {hasCoords ? (
                              <a
                                href={`https://www.google.com/maps?q=${loja.latitude},${loja.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 font-mono text-[10px] hover:bg-emerald-900/50 transition-colors"
                                title="Abrir no Google Maps"
                              >
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span>{Number(loja.latitude).toFixed(3)}, {Number(loja.longitude).toFixed(3)}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <AlertCircle className="w-3 h-3 text-amber-500/70" />
                                Sem GPS
                              </span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                isAtivo
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isAtivo ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                              {isAtivo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenEdit(loja)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-[#D4AF37]/20 border border-slate-700 text-slate-200 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors cursor-pointer text-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
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

      {/* Modal Criar / Editar Loja */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl relative my-8">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[#D4AF37]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingLoja ? `Editar Loja: ${editingLoja.nome}` : 'Registar Nova Loja'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Preencha os dados oficiais do balcão para georreferenciação
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

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Código da Loja */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Código da Loja *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo_loja}
                    onChange={(e) => setFormData({ ...formData, codigo_loja: e.target.value.toUpperCase() })}
                    placeholder="Código da loja"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white font-mono uppercase focus:outline-hidden focus:border-[#D4AF37]"
                    required
                  />
                  {formErrors.codigo_loja && (
                    <p className="text-[10px] text-rose-400 mt-1">{formErrors.codigo_loja}</p>
                  )}
                </div>

                {/* Nome da Loja */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Nome Comercial do Balcão *
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Diamante D'ouro - Baixa"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37]"
                    required
                  />
                  {formErrors.nome && (
                    <p className="text-[10px] text-rose-400 mt-1">{formErrors.nome}</p>
                  )}
                </div>
              </div>

              {/* Morada Completa */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono text-slate-400">
                    Morada Completa (Rua, Número, Localidade) *
                  </label>
                  <button
                    type="button"
                    onClick={handleTestGeocoding}
                    disabled={isGeocodingPreview || !formData.morada.trim()}
                    className="text-[11px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isGeocodingPreview ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Globe className="w-3 h-3" />
                    )}
                    <span>Testar no Mapa</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.morada}
                  onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                  placeholder="Rua Augusta 120, Lisboa"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#D4AF37]"
                  required
                />
                {formErrors.morada && (
                  <p className="text-[10px] text-rose-400 mt-1">{formErrors.morada}</p>
                )}
              </div>

              {/* Pré-visualização de Coordenadas Nominatim */}
              {previewCoords && (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-emerald-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-300">
                        Geolocalização Detetada
                      </p>
                      <p className="text-[10px] font-mono text-slate-300">
                        Lat: {previewCoords.lat.toFixed(5)} &bull; Long: {previewCoords.lng.toFixed(5)}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono border border-emerald-700/40">
                    Pronto a guardar
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NIF da Loja */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    NIF do Estabelecimento (9 dígitos) *
                  </label>
                  <input
                    type="text"
                    value={formData.nif_loja}
                    onChange={(e) => setFormData({ ...formData, nif_loja: e.target.value })}
                    placeholder="NIF (9 dígitos)"
                    maxLength={9}
                    required
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                  />
                  {formErrors.nif_loja && (
                    <p className="text-[10px] text-rose-400 mt-1">{formErrors.nif_loja}</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Telefone de Contacto (+351)
                  </label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="+351 9XX XXX XXX"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-[#D4AF37]"
                  />
                  {formErrors.telefone && (
                    <p className="text-[10px] text-rose-400 mt-1">{formErrors.telefone}</p>
                  )}
                </div>
              </div>

              {/* Estado Ativo Toggle */}
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                <div>
                  <p className="text-xs font-semibold text-white">Estado do Balcão</p>
                  <p className="text-[10px] text-slate-400">
                    Balcões inativos não surgem para novos registos de compras
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
                      <span>A processar no Nominatim...</span>
                    </>
                  ) : (
                    <span>{editingLoja ? 'Guardar Alterações' : 'Criar Balcão'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notificações Toast */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
