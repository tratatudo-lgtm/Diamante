-- Pesquisa privada de cliente por telefone normalizado.
-- Apenas service_role pode executar; não expõe diretório de clientes.
CREATE OR REPLACE FUNCTION public.lookup_whatsapp_client_by_phone(p_phone text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  WITH input AS (
    SELECT regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g') AS digits
  ),
  variants AS (
    SELECT digits AS phone FROM input WHERE length(digits) BETWEEN 8 AND 15
    UNION
    SELECT substring(digits FROM 4) FROM input
      WHERE digits LIKE '351%' AND length(digits) BETWEEN 11 AND 15
    UNION
    SELECT '351' || digits FROM input
      WHERE digits NOT LIKE '351%' AND length(digits) = 9
  ),
  matches AS (
    SELECT c.id, c.nome
    FROM public.clientes c
    WHERE regexp_replace(COALESCE(c.telemovel, ''), '[^0-9]', '', 'g')
      IN (SELECT phone FROM variants)
  )
  SELECT m.id, m.nome
  FROM matches m
  WHERE (SELECT count(*) FROM matches) = 1
    AND NULLIF(btrim(m.nome), '') IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.lookup_whatsapp_client_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_whatsapp_client_by_phone(text) TO service_role;

COMMENT ON FUNCTION public.lookup_whatsapp_client_by_phone(text) IS
  'Resolve uma correspondência única de telefone no CRM para o webhook WhatsApp; execução exclusiva do backend service_role.';
