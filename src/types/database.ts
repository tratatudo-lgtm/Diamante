/**
 * Diamante OS v2 - Schema Real da Base de Dados Conectada
 */

export type TransactionStatus = 'rascunho' | 'pendente_aprovacao' | 'aprovado' | 'pago';

export interface Funcionario {
  id: string;
  nome_completo: string;
  email?: string;
  role: 'admin' | 'operador' | 'gerente' | string;
  loja_id: string | null;
  ativo: boolean;
}

export interface Loja {
  id: string;
  nome: string;
  codigo_loja: string;
  morada: string;
  latitude: number | null;
  longitude: number | null;
  ativo?: boolean;
}

export interface Transacao {
  id: string;
  loja_id: string;
  funcionario_id?: string | null;
  estado: TransactionStatus;
  valor_final: number;
  peso_gramas: number;
  cliente_nome?: string | null;
  cliente_cc?: string | null;
  cliente_telemovel?: string | null;
  tipo_peca?: string | null;
  metal?: string | null;
  descricao?: string | null;
  created_at: string;
}

export interface KpiLojaDiaria {
  loja_id: string;
  data: string; // YYYY-MM-DD
  total_compras_qtd: number;
  total_compras_valor: number;
  total_peso_ouro_g?: number;
  pendentes_aprovacao_qtd: number;
}

export interface RegistoPonto {
  id: string;
  funcionario_id: string;
  loja_id: string;
  tipo: 'entrada' | 'saida';
  timestamp: string;
  localizacao?: { lat: number; lng: number } | string | null;
}

export interface InventarioFisico {
  id: string;
  loja_atual_id: string;
  transacao_origem_id?: string | null;
  codigo_unico: string;
  metal: string;
  peso_gramas: number;
  estado: 'em_loja' | 'enviado_sede' | 'fundido' | string;
  created_at?: string;
}

export interface ClienteProtegido {
  id?: string;
  nome?: string;
  bi_cc_formatado?: string;
  nif_formatado?: string | null;
  telemovel?: string;
  email?: string;
  morada_protegida?: string;
  loja_registo_id?: string;
  created_at?: string;
  historico_compras_count?: number;\n  tipo_documento?: string | null;\n  data_validade_documento?: string | null;\n  estado_documento?: 'valido' | 'a_expirar' | 'expirado' | 'sem_data';
}

export interface UserSessionData {
  user_id?: string;
  id?: string;
  nome_completo?: string;
  email?: string;
  role?: string;
  loja_id?: string | null;
  loja_nome?: string | null;
  codigo_loja?: string | null;
  ativo?: boolean;
  [key: string]: unknown;
}

export interface LojaComKpi extends Loja {
  total_compras_valor: number;
  pendentes_aprovacao_qtd: number;
  total_compras_qtd?: number;
  peso_total_hoje?: number;
}

export interface GlobalKpiData {
  volumeHoje: number;
  volumeOntem: number;
  pendentesHoje: number;
  pendentesOntem: number;
  pesoHoje: number;
  pesoOntem: number;
  lojasAtivas: number;
  totalLojas: number;
}
