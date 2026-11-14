// PATH: src/hooks/useSupabaseData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

async function adminApiRequest(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('diamante_jwt_token') : null;
  if (!token) throw new Error('Sessão administrativa não encontrada. Volte a iniciar sessão.');
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || 'Não foi possível concluir a operação.');
  }
  return result;
}

import type { Store } from '../types/supabase-schema';
import type { Employee, EmployeeRole, EmployeeStatus } from '../components/employees/EmployeeManagement';
import type { Client, ClientStatus } from '../components/clients/ClientManagement';
import type { FinancialTransaction, PaymentStatus, PaymentMethod } from '../components/finance/FinanceManagement';
import type {
  DatabaseLoja,
  DatabaseFuncionario,
  DatabaseCliente,
  DatabaseTransacaoFinanceira,
  DatabaseConfiguracaoSistema,
} from '../types/supabase-schema';

// =========================================================================
// HOOK 1: useStores (Lojas) — API administrativa protegida
// =========================================================================
export function useStores() {
  const [data, setData] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mapStore = (row: any): Store => ({
    id: String(row.id),
    codigo: row.codigo_loja || '',
    nome: row.nome || '',
    status: row.ativo === true ? 'ativa' : 'inativa',
    endereco: row.morada || '',
    nif: row.nif_loja || '',
    telefone: row.telefone || '',
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
  });

  const request = async (path: string, init: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('diamante_jwt_token') : null;
    if (!token) throw new Error('Sessão administrativa não encontrada. Volte a iniciar sessão.');
    const response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || 'Não foi possível concluir a operação.');
    }
    return result;
  };

  const fetchStores = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await request('/api/admin/lojas');
      if (!Array.isArray(result?.lojas)) throw new Error('A resposta da API de lojas é inválida.');
      setData(result.lojas.map(mapStore));
      return true;
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar lojas.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStores();
  }, [fetchStores]);

  const createStore = async (newStoreData: Omit<Store, 'id' | 'status' | 'latitude' | 'longitude'>) => {
    const result = await request('/api/admin/lojas', {
      method: 'POST',
      body: JSON.stringify({
        nome: newStoreData.nome,
        codigo_loja: newStoreData.codigo,
        morada: newStoreData.endereco,
        nif_loja: newStoreData.nif,
        telefone: newStoreData.telefone,
      }),
    });
    if (!result?.loja?.id) throw new Error('A API não devolveu a loja criada.');
    const created = mapStore(result.loja);
    setData((previous) => [...previous.filter((store) => store.id !== created.id), created].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT')));
    return created;
  };

  const updateStore = async (id: string, updates: Partial<Store>) => {
    const payload: Record<string, unknown> = {};
    if (updates.nome !== undefined) payload.nome = updates.nome;
    if (updates.codigo !== undefined) payload.codigo_loja = updates.codigo;
    if (updates.endereco !== undefined) payload.morada = updates.endereco;
    if (updates.nif !== undefined) payload.nif_loja = updates.nif;
    if (updates.telefone !== undefined) payload.telefone = updates.telefone;
    if (updates.status !== undefined) payload.ativo = updates.status === 'ativa';
    const result = await request(`/api/admin/lojas/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!result?.loja?.id) throw new Error('A API não devolveu a loja atualizada.');
    const updated = mapStore(result.loja);
    setData((previous) => previous.map((store) => store.id === id ? updated : store));
    return updated;
  };

  // Desativar preserva as relações e o histórico da loja.
  const deleteStore = async (id: string) => updateStore(id, { status: 'inativa' });

  return { data, loading, error, refetch: fetchStores, createStore, updateStore, deleteStore };
}

// =========================================================================
// HOOK 2: useEmployees (Funcionários)
// =========================================================================
export function useEmployees() {
  const [data, setData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. Configure a ligação antes de carregar dados.');

      if (isSupabaseConfigured()) {
        const { data: dbFuncs, error: dbError } = await supabase
          .from('funcionarios')
          .select('*, lojas(nome)')
          .order('nome_completo', { ascending: true });

        if (dbError) throw dbError;
        {
          const mapped: Employee[] = (dbFuncs || []).map((row: any) => {
            const roleStr = String(row.role || '').toLowerCase();
            const cargo: EmployeeRole = roleStr.includes('gerente') ? 'Gerente' : roleStr.includes('estag') ? 'Estagiário' : roleStr.includes('operador') ? 'Operador' : '';
            const status: EmployeeStatus = row.status === 'ausente' ? 'ausente' : row.status === 'ferias' ? 'ferias' : row.status === 'em_servico' ? 'em_servico' : '';

            return {
              id: String(row.id),
              codigo: row.codigo || '',
              nome: row.nome_completo || '',
              nif: row.nif || '',
              telemovel: row.telemovel || '',
              email: row.email || '',
              lojaId: row.loja_id || '',
              lojaNome: row.lojas?.nome || '',
              cargo,
              salarioBase: Number(row.salario_base) || 0,
              dataAdmissao: row.data_admissao || '',
              status,
              avatarColor: 'from-amber-600 to-yellow-600',
              especialidade: row.especialidade || '',
              transacoesMes: Number(row.transacoes_mes) || 0,
            };
          });

          setData(mapped);
          return;
        }
      }

      setData([]);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar funcionários');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const createEmployee = async (newEmp: Omit<Employee, 'id' | 'codigo' | 'avatarColor'>) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O funcionário não foi criado.');
    const { data: inserted, error } = await supabase.from('funcionarios').insert({
      nome_completo: newEmp.nome, nif: newEmp.nif, telemovel: newEmp.telemovel,
      email: newEmp.email, loja_id: newEmp.lojaId, role: newEmp.cargo.toLowerCase(),
      salario_base: newEmp.salarioBase, data_admissao: newEmp.dataAdmissao,
      especialidade: newEmp.especialidade, status: newEmp.status, ativo: true,
    }).select('id').single();
    if (error) throw error;
    if (!inserted?.id) throw new Error('A base de dados não devolveu o identificador do funcionário criado.');
    const created: Employee = {
      ...newEmp, id: String(inserted.id), codigo: '', avatarColor: 'from-[#D4AF37] to-amber-700',
    };
    setData((prev) => [created, ...prev]);
    return created;
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O funcionário não foi atualizado.');
    const { data: updatedRows, error } = await supabase.from('funcionarios').update({
      nome_completo: updates.nome, nif: updates.nif, telemovel: updates.telemovel,
      email: updates.email, loja_id: updates.lojaId,
      role: updates.cargo ? updates.cargo.toLowerCase() : undefined,
      salario_base: updates.salarioBase, data_admissao: updates.dataAdmissao,
      especialidade: updates.especialidade, status: updates.status || undefined,
    }).eq('id', id).select('id');
    if (error) throw error;
    if (!updatedRows?.length) throw new Error('O funcionário não foi encontrado ou não foi atualizado.');
    setData((prev) => prev.map((employee) => employee.id === id ? { ...employee, ...updates } : employee));
  };

  const deleteEmployee = async (id: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O funcionário não foi eliminado.');
    const { data: deletedRows, error } = await supabase.from('funcionarios').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!deletedRows?.length) throw new Error('O funcionário não foi encontrado ou não foi eliminado.');
    setData((prev) => prev.filter((employee) => employee.id !== id));
  };

  return { data, loading, error, refetch: fetchEmployees, createEmployee, updateEmployee, deleteEmployee };
}

// =========================================================================
// =========================================================================
// HOOK 3: useClients (Clientes & Fornecedores) — API autenticada
// =========================================================================
export function useClients() {
  const [data, setData] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mapClient = (row: any): Client => ({
    id: String(row.id),
    codigoCliente: row.codigo_cliente || '',
    nome: row.nome || '',
    nif: row.nif || '',
    telemovel: row.telemovel || '',
    email: row.email || '',
    docIdentificacao: row.bi_cc || '',
    dataNascimento: row.data_nascimento || '',
    morada: row.morada || '',
    cidade: row.cidade || '',
    lojaOrigemId: row.loja_registo_id || '',
    lojaOrigemNome: row.loja_nome || '',
    status: row.status === 'vip' || row.status === 'bloqueado' || row.status === 'normal' ? row.status as ClientStatus : 'normal',
    totalTransacoes: Number(row.total_transacoes) || 0,
    totalCompradoEUR: Number(row.total_comprado_eur) || 0,
    ultimaVisita: row.ultima_visita || '',
    dataRegisto: row.created_at ? new Date(row.created_at).toLocaleDateString('pt-PT') : '',
    notasInternas: row.notas_internas || '',
    historico: [],
  });

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApiRequest('/api/clients');
      setData(Array.isArray(result?.clientes) ? result.clientes.map(mapClient) : []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar clientes');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = async (newCli: Client) => {
    const result = await adminApiRequest('/api/clients', {
      method: 'POST',
      body: JSON.stringify({
        nome: newCli.nome,
        nif: newCli.nif,
        biCc: newCli.docIdentificacao,
        telemovel: newCli.telemovel,
        email: newCli.email,
        morada: newCli.morada,
        cidade: newCli.cidade,
        dataNascimento: newCli.dataNascimento,
        notasInternas: newCli.notasInternas,
        lojaOrigemId: newCli.lojaOrigemId,
        status: newCli.status,
        consentimentoRgpd: true,
      }),
    });
    if (!result?.cliente?.id) throw new Error('A API não devolveu o identificador do cliente criado.');
    const created = mapClient(result.cliente);
    setData((prev) => [created, ...prev.filter((client) => client.id !== created.id)]);
  };

  const updateClientStatus = async (clientId: string, status: ClientStatus) => {
    const result = await adminApiRequest(`/api/clients/${encodeURIComponent(clientId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!result?.cliente?.id) throw new Error('Não foi possível confirmar a alteração do cliente.');
    setData((prev) => prev.map((client) => client.id === clientId ? { ...client, status } : client));
  };

  const toggleBlockClient = async (clientId: string) => {
    const target = data.find((client) => client.id === clientId);
    if (!target) throw new Error('Cliente não encontrado.');
    await updateClientStatus(clientId, target.status === 'bloqueado' ? 'normal' : 'bloqueado');
  };

  const toggleVipClient = async (clientId: string) => {
    const target = data.find((client) => client.id === clientId);
    if (!target) throw new Error('Cliente não encontrado.');
    await updateClientStatus(clientId, target.status === 'vip' ? 'normal' : 'vip');
  };

  return { data, loading, error, refetch: fetchClients, createClient, toggleBlockClient, toggleVipClient };
}

// HOOK 4: useFinanceTransactions (Financeiro & Tesouraria)
// =========================================================================
export function useFinanceTransactions() {
  const [data, setData] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mapPayment = (row: any): FinancialTransaction => ({
    id: String(row.id),
    referencia: row.referencia || '',
    lojaId: row.loja_id || '',
    lojaNome: row.lojas?.nome || row.loja_nome || '',
    beneficiarioNome: row.beneficiario_nome || '',
    beneficiarioNif: row.beneficiario_nif || '',
    beneficiarioIban: row.beneficiario_iban || '',
    valor: Number(row.valor) || 0,
    estado: row.estado === 'pago' || row.estado === 'rejeitado' || row.estado === 'pendente' ? row.estado as PaymentStatus : '',
    data: row.data || (row.created_at ? new Date(row.created_at).toLocaleDateString('pt-PT') : ''),
    hora: row.hora || '',
    metodo: (row.metodo as PaymentMethod) || '',
    contaOrigem: row.conta_origem || '',
    descricao: row.descricao || '',
    pesoOuroGramas: Number(row.peso_ouro_gramas) || 0,
    tipoMetal: row.tipo_metal || '',
    operadorNome: row.operador_nome || '',
    comprovativoRef: row.comprovativo_ref || '',
  });

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApiRequest('/api/admin/finance/payments');
      if (!Array.isArray(result?.data)) throw new Error('A resposta da API financeira é inválida.');
      setData(result.data.map(mapPayment));
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar transações financeiras');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const updatePaymentStatus = async (txId: string, estado: 'pago' | 'rejeitado') => {
    await adminApiRequest(`/api/admin/finance/payments/${encodeURIComponent(txId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    setData((prev) => prev.map((tx) => tx.id === txId ? { ...tx, estado } : tx));
  };

  const confirmPayment = (txId: string) => updatePaymentStatus(txId, 'pago');
  const rejectPayment = (txId: string) => updatePaymentStatus(txId, 'rejeitado');

  const createPayment = async (newTx: FinancialTransaction) => {
    const result = await adminApiRequest('/api/admin/finance/payments', {
      method: 'POST',
      body: JSON.stringify({
        referencia: newTx.referencia,
        loja_id: newTx.lojaId,
        beneficiario_nome: newTx.beneficiarioNome,
        beneficiario_nif: newTx.beneficiarioNif,
        beneficiario_iban: newTx.beneficiarioIban,
        valor: newTx.valor,
        metodo: newTx.metodo,
        conta_origem: newTx.contaOrigem,
        descricao: newTx.descricao,
        peso_ouro_gramas: newTx.pesoOuroGramas,
        tipo_metal: newTx.tipoMetal,
        operador_nome: newTx.operadorNome,
        data: newTx.data,
        hora: newTx.hora,
        comprovativo_ref: newTx.comprovativoRef,
      }),
    });
    if (!result?.data?.id) throw new Error('A API não devolveu o pagamento criado.');
    const created = mapPayment(result.data);
    setData((prev) => [created, ...prev]);
    return created;
  };

  return { data, loading, error, refetch: fetchTransactions, confirmPayment, rejectPayment, createPayment };
}

// =========================================================================
// HOOK 5: useSystemSettings (Configurações Centrais do Sistema)
// =========================================================================
export interface SystemConfigData {
  general: {
    nomeEmpresa: string;
    nif: string;
    moradaSede: string;
    codigoPostal: string;
    cidade: string;
    telefoneSede: string;
    emailGeral: string;
    registoContrastaria: string;
    moedaPadrao: string;
    fusoHorario: string;
    logoUrl: string;
  };
  goldPrices: {
    ouro24k: number;
    ouro19k: number;
    ouro18k: number;
    ouro14k: number;
    ouro9k: number;
    prata925: number;
    margemSegurancaPercent: number;
    autoUpdate: boolean;
    intervaloMinutos: number;
    ultimaAtualizacao: string;
  };
}

const EMPTY_SETTINGS: SystemConfigData = {
  general: { nomeEmpresa: '', nif: '', moradaSede: '', codigoPostal: '', cidade: '', telefoneSede: '', emailGeral: '', registoContrastaria: '', moedaPadrao: '', fusoHorario: '', logoUrl: '' },
  goldPrices: { ouro24k: 0, ouro19k: 0, ouro18k: 0, ouro14k: 0, ouro9k: 0, prata925: 0, margemSegurancaPercent: 0, autoUpdate: false, intervaloMinutos: 0, ultimaAtualizacao: '' },
};

export function useSystemSettings() {
  const [data, setData] = useState<SystemConfigData>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApiRequest('/api/admin/settings');
      setData(result?.settings && typeof result.settings === 'object' ? result.settings as SystemConfigData : EMPTY_SETTINGS);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar configurações');
      setData(EMPTY_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newConfig: Partial<SystemConfigData>) => {
    const updated = { ...data, ...newConfig };
    const result = await adminApiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: updated }),
    });
    if (!result?.settings) throw new Error('A API não confirmou a gravação das configurações.');
    setData(result.settings as SystemConfigData);
  };

  return { data, loading, error, refetch: fetchSettings, saveSettings };
}
