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

export type InventarioFisicoEstado =
  | 'pendente_aprovacao'
  | 'em_loja'
  | 'enviado_sede'
  | 'recebido_sede'
  | 'em_lote_fundicao'
  | 'fundido';

export interface InventarioFisico {
  id: string;
  loja_atual_id: string;
  transacao_origem_id?: string | null;
  codigo_unico: string;
  tipo_peca?: string;
  metal: string;
  /** Peso registado na compra e mantido como referência de expedição. */
  peso_gramas: number;
  estado: InventarioFisicoEstado | string;
  data_entrada?: string;
  data_saida?: string | null;
  peso_recebido_gramas?: number | null;
  diferenca_peso_gramas?: number | null;
  recebido_por?: string | null;
  data_rececao?: string | null;
  observacoes_rececao?: string | null;
  observacoes?: string | null;
  localizacao_cofre?: string | null;
  data_prevista_fundicao?: string | null;
}

export interface OuroFundicaoLote {
  id: string;
  codigo_lote: string;
  estado: 'em_preparacao' | 'concluido';
  quantidade_pecas: number;
  peso_entrada_gramas: number;
  peso_recuperado_gramas?: number | null;
  toque_milesimos?: number | null;
  ouro_fino_recuperado_gramas?: number | null;
  perda_processo_gramas?: number | null;
  rendimento_percentagem?: number | null;
  criado_por: string;
  criado_em: string;
  concluido_por?: string | null;
  concluido_em?: string | null;
  observacoes?: string | null;
}

export interface OuroFundicaoLotePeca {
  id: string;
  lote_id: string;
  inventario_id: string;
  transacao_origem_id?: string | null;
  codigo_peca: string;
  peso_recebido_gramas: number;
  adicionado_em: string;
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
  historico_compras_count?: number;
  tipo_documento?: string | null;
  data_validade_documento?: string | null;
  estado_documento?: 'valido' | 'a_expirar' | 'expirado' | 'sem_data';
  consentimento_whatsapp_aniversario?: boolean;
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
  funcionariosAtivos: number;
  pecasEmLoja: number;
}
