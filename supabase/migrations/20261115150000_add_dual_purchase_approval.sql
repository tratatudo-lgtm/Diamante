-- Record the first approval separately for purchases requiring dual authorization.
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS primeira_aprovacao_por uuid,
  ADD COLUMN IF NOT EXISTS data_primeira_aprovacao timestamptz;

COMMENT ON COLUMN public.transacoes.primeira_aprovacao_por IS
  'First administrator signature for purchases requiring dual authorization.';
COMMENT ON COLUMN public.transacoes.data_primeira_aprovacao IS
  'Timestamp of the first administrator signature for purchases requiring dual authorization.';
