-- Diamante D'Ouro | Consolidate RLS policies and harden identity helpers
-- Removes legacy permissive policies that bypass the table-specific rules.
-- Fails closed on the unused vault movement table until its workflow is implemented.

-- 1) Remove legacy FOR ALL policies. The specific authenticated policies remain:
--    SELECT: admin or own store
--    INSERT: admin or own store
--    UPDATE: admin or store manager for that row
--    DELETE: admin only
DROP POLICY IF EXISTS "Artigos_visiveis_apenas_pela_loja" ON public.artigos;
DROP POLICY IF EXISTS "Caixa_diario_visivel_apenas_pela_loja" ON public.caixa_diario;

-- 2) Bind the legacy helper to the authenticated user UUID, never to a mutable
--    JWT email claim. Keep it for compatibility with any external SQL callers.
CREATE OR REPLACE FUNCTION public.get_auth_funcionario_loja_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
  SELECT f.loja_id
  FROM public.funcionarios AS f
  WHERE f.id = (SELECT auth.uid())
    AND f.ativo = true
  LIMIT 1;
$function$;

-- 3) Pin search_path for SECURITY DEFINER helpers. Explicitly include public
--    for the session function's unqualified table references; keep pg_temp last.
ALTER FUNCTION public.get_auth_user_loja_id()
  SET search_path = pg_catalog, public, auth, pg_temp;

ALTER FUNCTION public.get_auth_user_role()
  SET search_path = pg_catalog, public, auth, pg_temp;

ALTER FUNCTION public.get_user_session_data()
  SET search_path = pg_catalog, public, auth, pg_temp;

ALTER FUNCTION public.is_admin()
  SET search_path = pg_catalog, public, auth, pg_temp;

ALTER FUNCTION public.is_gestor_loja(uuid)
  SET search_path = pg_catalog, public, auth, pg_temp;

-- 4) movimentacoes_cofre is not used by the current application code and has
--    no implemented author/store validation. Remove the unconditional INSERT
--    policy and block authenticated writes until a validated workflow exists.
DROP POLICY IF EXISTS "Registo de movimentações" ON public.movimentacoes_cofre;
REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.movimentacoes_cofre
  FROM authenticated;

-- No rows are changed. Existing service_role access is intentionally preserved.
