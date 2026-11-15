-- Track the physical receipt of gold dispatched from stores to headquarters.
-- Keep the dispatch weight immutable and store the independently measured
-- receiving weight, difference, responsible administrator and timestamp.
ALTER TABLE public.inventario_fisico
  ADD COLUMN IF NOT EXISTS peso_recebido_gramas numeric(12,3),
  ADD COLUMN IF NOT EXISTS diferenca_peso_gramas numeric(12,3),
  ADD COLUMN IF NOT EXISTS recebido_por uuid,
  ADD COLUMN IF NOT EXISTS data_rececao timestamptz,
  ADD COLUMN IF NOT EXISTS observacoes_rececao text;

CREATE INDEX IF NOT EXISTS idx_inventario_fisico_receiving_queue
  ON public.inventario_fisico (data_saida)
  WHERE estado = 'enviado_sede';

CREATE INDEX IF NOT EXISTS idx_inventario_fisico_received_by
  ON public.inventario_fisico (recebido_por)
  WHERE recebido_por IS NOT NULL;

COMMENT ON COLUMN public.inventario_fisico.peso_recebido_gramas IS
  'Peso medido fisicamente na recepção na sede, independente do peso declarado pela loja.';
COMMENT ON COLUMN public.inventario_fisico.diferenca_peso_gramas IS
  'Diferença entre peso recebido e peso declarado na expedição (recebido - declarado).';
