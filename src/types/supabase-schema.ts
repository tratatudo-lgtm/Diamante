// PATH: src/types/supabase-schema.ts
/**
 * Diamante OS v2 - Schema Supabase Estrito
 * Tabelas: lojas, funcionarios, clientes, transacoes_financeiras e configuracoes_sistema
 */

export interface Store {
  id: string;
  codigo: string;
  nome: string;
  status: 'ativa' | 'inativa';
  endereco: string;
  nif: string;
  telefone: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DatabaseLoja {
  id: string;
  nome: string;
  morada: string;
  nif_loja: string;
  telefone?: string | null;
  codigo_loja?: string | null;
  created_at: string;
  admin_id?: string | null;
  ativo: boolean;
  latitude?: number | null;
  longitude?: number | null;
}
export interface DatabaseFuncionario {
  id: string;
  nome_completo: string;
  telemovel: string;
  email?: string | null;
  loja_id: string | null;
  role: 'admin' | 'operador' | 'gerente' | 'master' | string;
  salario_base?: number | null;
  data_admissao?: string | null;
  status?: 'em_servico' | 'ausente' | 'ferias' | string;
  ativo: boolean;
  especialidade?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseCliente {
  id: string;
  codigo_cliente: string;
  nome: string;
  nif: string;
  telemovel: string;
  email?: string | null;
  doc_identificacao?: string | null;
  data_nascimento?: string | null;
  morada?: string | null;
  cidade?: string | null;
  loja_origem_id?: string | null;
  status: 'vip' | 'normal' | 'bloqueado' | string;
  total_transacoes?: number;
  total_comprado_eur?: number;
  ultima_visita?: string | null;
  notas_internas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseTransacaoFinanceira {
  id: string;
  referencia: string;
  loja_id: string;
  loja_nome?: string | null;
  beneficiario_nome: string;
  beneficiario_nif: string;
  beneficiario_iban?: string | null;
  valor: number;
  estado: 'pago' | 'pendente' | 'rejeitado' | string;
  metodo: string;
  conta_origem?: string | null;
  descricao?: string | null;
  peso_ouro_gramas?: number | null;
  tipo_metal?: string | null;
  operador_nome?: string | null;
  comprovativo_ref?: string | null;
  data?: string | null;
  hora?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseConfiguracaoSistema {
  chave: string;
  valor: Record<string, unknown>;
  updated_at: string;
}

export interface SupabaseDatabaseSchema {
  public: {
    Tables: {
      lojas: {
        Row: DatabaseLoja;
        Insert: Partial<DatabaseLoja> & Pick<DatabaseLoja, 'nome' | 'codigo_loja' | 'morada'>;
        Update: Partial<DatabaseLoja>;
      };
      funcionarios: {
        Row: DatabaseFuncionario;
        Insert: Partial<DatabaseFuncionario> & Pick<DatabaseFuncionario, 'nome_completo' | 'telemovel'>;
        Update: Partial<DatabaseFuncionario>;
      };
      clientes: {
        Row: DatabaseCliente;
        Insert: Partial<DatabaseCliente> & Pick<DatabaseCliente, 'nome' | 'nif' | 'telemovel'>;
        Update: Partial<DatabaseCliente>;
      };
      transacoes_financeiras: {
        Row: DatabaseTransacaoFinanceira;
        Insert: Partial<DatabaseTransacaoFinanceira> & Pick<DatabaseTransacaoFinanceira, 'referencia' | 'loja_id' | 'valor'>;
        Update: Partial<DatabaseTransacaoFinanceira>;
      };
      configuracoes_sistema: {
        Row: DatabaseConfiguracaoSistema;
        Insert: Partial<DatabaseConfiguracaoSistema> & Pick<DatabaseConfiguracaoSistema, 'chave' | 'valor'>;
        Update: Partial<DatabaseConfiguracaoSistema>;
      };
    };
  };
}
