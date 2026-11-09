// PATH: src/types/supabase-schema.ts
/**
 * Diamante OS v2 - Schema Supabase Estrito
 * Tabelas: 'lojas', 'funcionarios', 'clientes', 'transacoes_financeiras', 'configuracoes_sistema'
 */

export interface DatabaseLoja {
  id: string;
  codigo_loja: string;
  nome: string;
  morada: string;
  nif_loja?: string | null;
  telefone?: string | null;
  email?: string | null;
  gerente?: string | null;
  horario?: string | null;
  cidade?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  meta_mes?: number | null;
  created_at?: string;
  updated_at?: string;
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
  id: string;
  chave: string;
  valor: any; // JSONB ou texto estruturado
  descricao?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
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
