-- Add tax identification to customer records while preserving legacy rows without an NIF.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS codigo_cliente text NOT NULL DEFAULT ('CLI-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS data_nascimento text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS notas_internas text;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_nif_format_check,
  ADD CONSTRAINT clientes_nif_format_check
    CHECK (nif IS NULL OR nif ~ '^[0-9]{9}$'),
  DROP CONSTRAINT IF EXISTS clientes_status_check,
  ADD CONSTRAINT clientes_status_check
    CHECK (status IN ('normal', 'vip', 'bloqueado'));

CREATE UNIQUE INDEX IF NOT EXISTS clientes_nif_unique_idx
  ON public.clientes (nif)
  WHERE nif IS NOT NULL;

CREATE OR REPLACE VIEW public.v_clientes_protegidos
WITH (security_invoker = true)
AS
SELECT
  id,
  nome,
  (left(bi_cc, 4) || '****') AS bi_cc_formatado,
  ((left(telemovel, 3) || '***') || right(telemovel, 2)) AS telemovel,
  CASE
    WHEN email IS NULL OR btrim(email) = '' THEN NULL
    WHEN position('@' in email) > 1
      THEN left(split_part(email, '@', 1), 1) || '***@' || split_part(email, '@', 2)
    ELSE left(email, 1) || '***'
  END AS email,
  (left(morada, 10) || '...') AS morada_protegida,
  loja_registo_id,
  created_at,
  (SELECT count(*) FROM public.transacoes t WHERE t.cliente_cc = clientes.bi_cc) AS historico_compras_count,
  CASE
    WHEN nif IS NULL OR btrim(nif) = '' THEN NULL
    ELSE left(nif, 2) || '*****' || right(nif, 2)
  END AS nif_formatado
FROM public.clientes AS clientes;
