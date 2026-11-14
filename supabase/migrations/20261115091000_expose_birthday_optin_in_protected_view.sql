-- Expose only the opt-in flag in the protected store view; never expose full contact details.
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
  CASE WHEN nif IS NULL OR btrim(nif) = '' THEN NULL
    ELSE left(nif, 2) || '*****' || right(nif, 2) END AS nif_formatado,
  tipo_documento,
  data_validade_documento,
  consentimento_whatsapp_aniversario
FROM public.clientes AS clientes;

GRANT SELECT ON public.v_clientes_protegidos TO authenticated;
