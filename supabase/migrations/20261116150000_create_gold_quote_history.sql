-- Auditable history of every market quote imported for gold purchasing.
CREATE TABLE IF NOT EXISTS public.cotacoes_ouro_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  preco_referencia numeric(18,6) NOT NULL CHECK (preco_referencia > 0),
  moeda text NOT NULL CHECK (moeda = 'EUR'),
  unidade text NOT NULL CHECK (unidade = 'EUR/g_ouro_fino'),
  observada_em timestamptz NOT NULL,
  recebida_em timestamptz NOT NULL,
  importada_em timestamptz NOT NULL DEFAULT now(),
  margens_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado_fonte jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT cotacoes_ouro_historico_fonte_chk CHECK (length(btrim(fonte)) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_cotacoes_ouro_historico_importada
  ON public.cotacoes_ouro_historico (importada_em DESC);
CREATE INDEX IF NOT EXISTS idx_cotacoes_ouro_historico_observada
  ON public.cotacoes_ouro_historico (observada_em DESC);

ALTER TABLE public.cotacoes_ouro_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cotacoes_ouro_historico FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.cotacoes_ouro_historico TO service_role;
