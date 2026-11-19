CREATE TABLE IF NOT EXISTS public.despesas_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE RESTRICT,
  categoria text NOT NULL CHECK (categoria IN ('renda','pessoal','energia_agua','comunicacoes','seguros','manutencao','material','marketing','servicos','impostos_taxas','transporte','outros')),
  descricao text NOT NULL CHECK (length(trim(descricao)) BETWEEN 3 AND 1000),
  fornecedor text,
  referencia_documento text,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data_despesa date NOT NULL,
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','aprovada','rejeitada','paga')),
  comprovativo_ref text,
  criado_por uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  aprovado_por uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  pago_por uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS despesas_operacionais_loja_data_idx ON public.despesas_operacionais(loja_id, data_despesa DESC);
CREATE INDEX IF NOT EXISTS despesas_operacionais_estado_data_idx ON public.despesas_operacionais(estado, data_despesa DESC);
ALTER TABLE public.despesas_operacionais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.despesas_operacionais FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.despesas_operacionais TO service_role;
COMMENT ON TABLE public.despesas_operacionais IS 'Despesas operacionais por loja; todas as operações passam pela API administrativa autenticada.';
