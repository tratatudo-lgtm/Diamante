-- Financial payouts are a separate domain from gold-purchase transactions.
-- Only active administrators may inspect, create, or change payment records.
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia text NOT NULL UNIQUE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE RESTRICT,
  loja_nome text,
  beneficiario_nome text NOT NULL,
  beneficiario_nif text NOT NULL DEFAULT '',
  beneficiario_iban text,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  estado text NOT NULL DEFAULT 'pendente'
    CHECK (estado IN ('pendente', 'pago', 'rejeitado')),
  metodo text NOT NULL
    CHECK (metodo IN ('Transferência Imediata', 'Transferência SEPA', 'Numerário Balcão', 'Cheque Bancário')),
  conta_origem text,
  descricao text,
  peso_ouro_gramas numeric(14,3) CHECK (peso_ouro_gramas IS NULL OR peso_ouro_gramas >= 0),
  tipo_metal text,
  operador_nome text,
  comprovativo_ref text,
  data text,
  hora text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transacoes_financeiras_referencia_not_blank CHECK (length(btrim(referencia)) > 0),
  CONSTRAINT transacoes_financeiras_beneficiario_not_blank CHECK (length(btrim(beneficiario_nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_created_at
  ON public.transacoes_financeiras (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_loja_estado
  ON public.transacoes_financeiras (loja_id, estado);

ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.transacoes_financeiras FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transacoes_financeiras TO authenticated;

DROP POLICY IF EXISTS transacoes_financeiras_admin_select ON public.transacoes_financeiras;
CREATE POLICY transacoes_financeiras_admin_select
ON public.transacoes_financeiras FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS transacoes_financeiras_admin_insert ON public.transacoes_financeiras;
CREATE POLICY transacoes_financeiras_admin_insert
ON public.transacoes_financeiras FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS transacoes_financeiras_admin_update ON public.transacoes_financeiras;
CREATE POLICY transacoes_financeiras_admin_update
ON public.transacoes_financeiras FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMENT ON TABLE public.transacoes_financeiras IS
  'Pagamentos e liquidações a beneficiários; separado das transações de compra de ouro.';
