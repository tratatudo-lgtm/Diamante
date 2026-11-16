-- Itemised operational costs for gold refining batches.
CREATE TABLE IF NOT EXISTS public.ouro_fundicao_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.ouro_fundicao_lotes(id) ON DELETE RESTRICT,
  categoria text NOT NULL CHECK (categoria IN ('transporte','analise','fundicao','outro')),
  descricao text NOT NULL CHECK (char_length(btrim(descricao)) BETWEEN 2 AND 300),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  registado_por uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ouro_fundicao_custos_lote ON public.ouro_fundicao_custos(lote_id, criado_em);
ALTER TABLE public.ouro_fundicao_custos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ouro_fundicao_custos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ouro_fundicao_custos TO service_role;
COMMENT ON TABLE public.ouro_fundicao_custos IS
  'Encargos operacionais discriminados por lote; separados do custo de aquisição.';
