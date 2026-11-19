-- Minimize personal data exposed by the protected clients view.
-- Keep invoker security so underlying clientes RLS remains enforced.
CREATE OR REPLACE VIEW public.v_clientes_protegidos
WITH (security_invoker = true)
AS
SELECT
  id,
  nome,
  left(bi_cc, 4) || '****' AS bi_cc_formatado,
  left(telemovel, 3) || '***' || right(telemovel, 2) AS telemovel,
  CASE
    WHEN email IS NULL OR btrim(email) = '' THEN NULL
    WHEN position('@' IN email) > 1 THEN left(split_part(email, '@', 1), 1) || '***@' || split_part(email, '@', 2)
    ELSE left(email, 1) || '***'
  END AS email,
  left(morada, 10) || '...' AS morada_protegida,
  loja_registo_id,
  created_at,
  (
    SELECT count(*)
    FROM public.transacoes AS t
    WHERE t.cliente_cc = clientes.bi_cc
  ) AS historico_compras_count
FROM public.clientes AS clientes;

ALTER VIEW public.v_clientes_protegidos SET (security_invoker = true);
