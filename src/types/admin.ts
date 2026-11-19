// PATH: src/types/admin.ts
/**
 * Tipos e interfaces estritas para o Módulo de Gestão Administrativa
 * Diamante OS v2 - Exclusivo para Master User (+351937230116)
 */

export interface AdminLoja {
  id: string;
  nome: string;
  codigo_loja: string;
  morada: string;
  nif_loja?: string | null;
  telefone?: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  total_funcionarios?: number;
  total_compras_hoje?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLojaDTO {
  nome: string;
  morada: string;
  nif_loja: string;
  telefone: string;
  codigo_loja: string;
}

export interface UpdateLojaDTO {
  nome?: string;
  morada?: string;
  nif_loja?: string;
  telefone?: string;
  codigo_loja?: string;
  ativo?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AdminFuncionario {
  id: string;
  nome_completo: string;
  telemovel: string;
  email?: string | null;
  loja_id: string | null;
  loja_nome?: string | null;
  codigo_loja?: string | null;
  role: 'admin' | 'operador' | 'gerente' | string;
  ativo: boolean;
  ultimo_ponto?: string | null;
  created_at?: string;
}

export interface CreateFuncionarioDTO {
  nome_completo: string;
  telemovel: string;
  loja_id: string | null;
  role: 'admin' | 'operador' | 'gerente' | string;
  email?: string;
}

export interface UpdateFuncionarioDTO {
  nome_completo?: string;
  telemovel?: string;
  loja_id?: string | null;
  role?: string;
  ativo?: boolean;
  email?: string;
}

export interface MargemMetalConfig {
  id: string;
  metal_tipo: string; // Ex: 'Ouro 19.2k', 'Ouro 24k', 'Ouro 18k', 'Ouro 14k', 'Ouro 9k', 'Prata 925'
  descricao: string;
  toque_millesimos: number; // Ex: 800 para 19.2k, 999 para 24k
  cotacao_referencia_g: number; // EUR/grama de ouro fino internacional
  margem_percentagem: number; // Margem da empresa (ex: 15%)
  preco_compra_grama: number; // Calculado: Cotação * (Toque / 1000) * (1 - Margem%)
  desconto_maximo_loja_perc: number; // Margem de flexibilidade para o operador (ex: 3%)
  loja_id?: string | null; // null = global para todas as lojas
  ativo: boolean;
}

export interface TetoAprovacaoConfig {
  id: string;
  loja_id?: string | null;
  valor_limite_sem_aprovacao: number; // EUR (ex: 1000)
  peso_limite_sem_aprovacao_g: number; // Gramas (ex: 50)
  exigir_dupla_assinatura_acima: number; // EUR (ex: 5000)
  notificar_whatsapp_master: boolean;
  telemovel_alerta?: string;
  ativo: boolean; // Estado geral da configuração, independente da política de aprovação.
  exigir_dupla_assinatura: boolean; // Exige dois administradores a partir do limite definido.
}

export interface ContaBancariaConfig {
  id: string;
  banco: string;
  iban: string;
  titular: string;
  descricao?: string;
  ativo: boolean;
  padrao: boolean;
}

export interface AdminSystemConfig {
  margens: MargemMetalConfig[];
  tetos: TetoAprovacaoConfig;
  contasBancarias: ContaBancariaConfig[];
}
