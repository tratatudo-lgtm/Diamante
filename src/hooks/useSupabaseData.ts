// PATH: src/hooks/useSupabaseData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Store } from '../components/stores/StoreManagement';
import type { Employee, EmployeeRole, EmployeeStatus } from '../components/employees/EmployeeManagement';
import type { Client, ClientStatus, ClientTransactionRecord } from '../components/clients/ClientManagement';
import type { FinancialTransaction, PaymentStatus, PaymentMethod } from '../components/finance/FinanceManagement';
import type {
  DatabaseLoja,
  DatabaseFuncionario,
  DatabaseCliente,
  DatabaseTransacaoFinanceira,
  DatabaseConfiguracaoSistema,
} from '../types/supabase-schema';

// =========================================================================
// HOOK 1: useStores (Lojas)
// =========================================================================
export function useStores() {
  const [data, setData] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. Configure a ligação antes de carregar dados.');

      if (isSupabaseConfigured()) {
        const { data: dbLojas, error: dbError } = await supabase
          .from('lojas')
          .select('*')
          .order('nome', { ascending: true });

        if (dbError) {
          throw dbError;
        }

        if (dbLojas && dbLojas.length > 0) {
          // Mapeia o registo da base de dados para o modelo Store do frontend
          const mapped: Store[] = (dbLojas || []).map((row: any) => ({
            id: String(row.id), codigo: row.codigo_loja || row.codigo || '',
            nome: row.nome || '', status: row.ativo === true ? 'ativa' : row.ativo === false ? 'inativa' : '',
            endereco: row.morada || row.endereco || '', cidade: row.cidade || '',
            gerente: row.gerente || '', telefone: row.telefone || '', email: row.email || '',
            horario: row.horario || '', nif: row.nif_loja || row.nif || '',
            volumeMes: Number(row.volume_mes) || 0, metaMes: Number(row.meta_mes) || 0,
            progressoMeta: Number(row.progresso_meta) || 0, totalTransacoesMes: Number(row.total_transacoes) || 0,
            ouroCompradoGramas: Number(row.peso_ouro_g) || 0, dataAbertura: row.data_abertura || '',
          }));

          setData(mapped);
          return;
        }
      }

      setData([]);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar lojas com Supabase');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Mutations
  const createStore = async (newStoreData: Omit<Store, 'id' | 'codigo' | 'volumeMes' | 'progressoMeta' | 'totalTransacoesMes' | 'ouroCompradoGramas' | 'dataAbertura'>) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. A loja não foi criada.');
    const codigo = `LOJ-${String(data.length + 1).padStart(3, '0')}`;
    const { data: inserted, error } = await supabase.from('lojas').insert({
      codigo_loja: codigo, nome: newStoreData.nome, morada: newStoreData.endereco,
      cidade: newStoreData.cidade, gerente: newStoreData.gerente, telefone: newStoreData.telefone,
      email: newStoreData.email, horario: newStoreData.horario, nif_loja: newStoreData.nif,
      meta_mes: newStoreData.metaMes, ativo: newStoreData.status === 'ativa',
    }).select('id').single();
    if (error) throw error;
    const created: Store = {
      ...newStoreData, id: String(inserted.id), codigo, volumeMes: 0, metaMes: 0,
      progressoMeta: 0, totalTransacoesMes: 0, ouroCompradoGramas: 0, dataAbertura: '',
    };
    setData((prev) => [created, ...prev]);
    return created;
  };

  const updateStore = async (id: string, updates: Partial<Store>) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. A loja não foi atualizada.');
    const { error } = await supabase.from('lojas').update({
      nome: updates.nome, morada: updates.endereco, cidade: updates.cidade, gerente: updates.gerente,
      telefone: updates.telefone, email: updates.email, horario: updates.horario,
      nif_loja: updates.nif, meta_mes: updates.metaMes,
      ativo: updates.status !== undefined ? updates.status === 'ativa' : undefined,
    }).eq('id', id);
    if (error) throw error;
    setData((prev) => prev.map((store) => store.id === id ? { ...store, ...updates } : store));
  };

  const deleteStore = async (id: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. A loja não foi eliminada.');
    const { error } = await supabase.from('lojas').delete().eq('id', id);
    if (error) throw error;
    setData((prev) => prev.filter((store) => store.id !== id));
  };

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
    const created: Employee = {
      ...newEmp, id: String(inserted.id), codigo: '', avatarColor: 'from-[#D4AF37] to-amber-700',
    };
    setData((prev) => [created, ...prev]);
    return created;
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O funcionário não foi atualizado.');
    const { error } = await supabase.from('funcionarios').update({
      nome_completo: updates.nome, nif: updates.nif, telemovel: updates.telemovel,
      email: updates.email, loja_id: updates.lojaId,
      role: updates.cargo ? updates.cargo.toLowerCase() : undefined,
      salario_base: updates.salarioBase, data_admissao: updates.dataAdmissao,
      especialidade: updates.especialidade, status: updates.status,
    }).eq('id', id);
    if (error) throw error;
    setData((prev) => prev.map((employee) => employee.id === id ? { ...employee, ...updates } : employee));
  };

  const deleteEmployee = async (id: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O funcionário não foi eliminado.');
    const { error } = await supabase.from('funcionarios').delete().eq('id', id);
    if (error) throw error;
    setData((prev) => prev.filter((employee) => employee.id !== id));
  };

  return { data, loading, error, refetch: fetchEmployees, createEmployee, updateEmployee, deleteEmployee };
}

// =========================================================================
// HOOK 3: useClients (Clientes & Fornecedores)
// =========================================================================
export function useClients() {
  const [data, setData] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. Configure a ligação antes de carregar dados.');

      if (isSupabaseConfigured()) {
        const { data: dbClients, error: dbError } = await supabase
          .from('clientes')
          .select('*')
          .order('nome', { ascending: true });

        if (dbError) throw dbError;
        {
          const mapped: Client[] = (dbClients || []).map((row: any) => ({
            id: String(row.id),
            codigoCliente: row.codigo_cliente || '',
            nome: row.nome,
            nif: row.nif,
            telemovel: row.telemovel,
            email: row.email || '',
            docIdentificacao: row.doc_identificacao || '',
            dataNascimento: row.data_nascimento || '',
            morada: row.morada || '',
            cidade: row.cidade || '',
            lojaOrigemId: row.loja_origem_id || '',
            lojaOrigemNome: row.loja_origem_nome || '',
            status: row.status === 'vip' || row.status === 'bloqueado' || row.status === 'normal' ? row.status as ClientStatus : '',
            totalTransacoes: Number(row.total_transacoes) || 0,
            totalCompradoEUR: Number(row.total_comprado_eur) || 0.0,
            ultimaVisita: row.ultima_visita || '',
            dataRegisto: row.created_at ? new Date(row.created_at).toLocaleDateString('pt-PT') : '',
            notasInternas: row.notas_internas || '',
            historico: Array.isArray(row.historico) ? row.historico : [],
          }));

          setData(mapped);
          return;
        }
      }

      setData([]);
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
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O cliente não foi criado.');
    const { data: inserted, error } = await supabase.from('clientes').insert({
      codigo_cliente: newCli.codigoCliente, nome: newCli.nome, nif: newCli.nif,
      telemovel: newCli.telemovel, email: newCli.email, doc_identificacao: newCli.docIdentificacao,
      data_nascimento: newCli.dataNascimento, morada: newCli.morada, cidade: newCli.cidade,
      loja_origem_id: newCli.lojaOrigemId, status: newCli.status, notas_internas: newCli.notasInternas,
    }).select('id').single();
    if (error) throw error;
    setData((prev) => [{ ...newCli, id: String(inserted.id) }, ...prev]);
  };

  const toggleBlockClient = async (clientId: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O estado do cliente não foi alterado.');
    const target = data.find((client) => client.id === clientId);
    if (!target) throw new Error('Cliente não encontrado.');
    const nextStatus: ClientStatus = target.status === 'bloqueado' ? 'normal' : 'bloqueado';
    const { error } = await supabase.from('clientes').update({ status: nextStatus }).eq('id', clientId);
    if (error) throw error;
    setData((prev) => prev.map((client) => client.id === clientId ? { ...client, status: nextStatus } : client));
  };

  const toggleVipClient = async (clientId: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O estado VIP não foi alterado.');
    const target = data.find((client) => client.id === clientId);
    if (!target) throw new Error('Cliente não encontrado.');
    const nextStatus: ClientStatus = target.status === 'vip' ? 'normal' : 'vip';
    const { error } = await supabase.from('clientes').update({ status: nextStatus }).eq('id', clientId);
    if (error) throw error;
    setData((prev) => prev.map((client) => client.id === clientId ? { ...client, status: nextStatus } : client));
  };

  return { data, loading, error, refetch: fetchClients, createClient, toggleBlockClient, toggleVipClient };
}

// =========================================================================
// HOOK 4: useFinanceTransactions (Financeiro & Tesouraria)
// =========================================================================
export function useFinanceTransactions() {
  const [data, setData] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. Configure a ligação antes de carregar dados.');

      if (isSupabaseConfigured()) {
        // Tenta 'transacoes_financeiras' ou tabela 'transacoes' existente
        const { data: dbTx, error: dbError } = await supabase
          .from('transacoes_financeiras')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;
        {
          const mapped: FinancialTransaction[] = (dbTx || []).map((row: any) => ({
            id: String(row.id),
            referencia: row.referencia || '',
            lojaId: row.loja_id || '',
            lojaNome: row.loja_nome || '',
            beneficiarioNome: row.beneficiario_nome || '',
            beneficiarioNif: row.beneficiario_nif || '',
            beneficiarioIban: row.beneficiario_iban || '',
            valor: Number(row.valor) || 0,
            estado: row.estado === 'pago' || row.estado === 'rejeitado' || row.estado === 'pendente' ? row.estado as PaymentStatus : '',
            data: row.data || new Date(row.created_at || Date.now()).toLocaleDateString('pt-PT'),
            hora: row.hora || '',
            metodo: (row.metodo as PaymentMethod) || '',
            contaOrigem: row.conta_origem || '',
            descricao: row.descricao || '',
            pesoOuroGramas: Number(row.peso_ouro_gramas) || 0,
            tipoMetal: row.tipo_metal || '',
            operadorNome: row.operador_nome || '',
            comprovativoRef: row.comprovativo_ref || '',
          }));

          setData(mapped);
          return;
        }
      }

      setData([]);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar transações financeiras');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const confirmPayment = async (txId: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O pagamento não foi confirmado.');
    const { error } = await supabase.from('transacoes_financeiras').update({ estado: 'pago' }).eq('id', txId);
    if (error) throw error;
    setData((prev) => prev.map((tx) => tx.id === txId ? { ...tx, estado: 'pago' } : tx));
  };

  const rejectPayment = async (txId: string) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O pagamento não foi rejeitado.');
    const { error } = await supabase.from('transacoes_financeiras').update({ estado: 'rejeitado' }).eq('id', txId);
    if (error) throw error;
    setData((prev) => prev.map((tx) => tx.id === txId ? { ...tx, estado: 'rejeitado' } : tx));
  };

  const createPayment = async (newTx: FinancialTransaction) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. O pagamento não foi criado.');
    const { data: inserted, error } = await supabase.from('transacoes_financeiras').insert({
      referencia: newTx.referencia, loja_id: newTx.lojaId, loja_nome: newTx.lojaNome,
      beneficiario_nome: newTx.beneficiarioNome, beneficiario_nif: newTx.beneficiarioNif,
      beneficiario_iban: newTx.beneficiarioIban, valor: newTx.valor, estado: newTx.estado,
      metodo: newTx.metodo, conta_origem: newTx.contaOrigem, descricao: newTx.descricao,
      peso_ouro_gramas: newTx.pesoOuroGramas, tipo_metal: newTx.tipoMetal,
      operador_nome: newTx.operadorNome, data: newTx.data, hora: newTx.hora,
      comprovativo_ref: newTx.comprovativoRef,
    }).select('id').single();
    if (error) throw error;
    setData((prev) => [{ ...newTx, id: String(inserted.id) }, ...prev]);
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
      if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. Configure a ligação antes de carregar dados.');

      if (isSupabaseConfigured()) {
        const { data: dbConfig, error: dbError } = await supabase
          .from('configuracoes_sistema')
          .select('*')
          .eq('chave', 'geral_sistema')
          .single();

        if (dbError && dbError.code !== 'PGRST116') throw dbError;
        if (dbConfig?.valor) {
          setData(dbConfig.valor as SystemConfigData);
          return;
        }
      }

      setData(EMPTY_SETTINGS);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sincronizar configurações');
      setData(EMPTY_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (newConfig: Partial<SystemConfigData>) => {
    if (!isSupabaseConfigured()) throw new Error('Supabase não está configurada. As definições não foram guardadas.');
    const updated = { ...data, ...newConfig };
    const { error } = await supabase.from('configuracoes_sistema').upsert({
      chave: 'geral_sistema', valor: updated, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setData(updated);
  };

  return { data, loading, error, refetch: fetchSettings, saveSettings };
}
