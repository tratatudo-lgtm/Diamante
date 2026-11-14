-- Keep the role lookup aligned with public.funcionarios.role, which is TEXT.
-- The user_role enum does not represent the values currently stored for employees.
DROP FUNCTION IF EXISTS public.get_auth_user_role();

CREATE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
  SELECT f.role
  FROM public.funcionarios AS f
  WHERE f.id = (SELECT auth.uid())
    AND f.ativo = true
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_auth_user_role()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_auth_user_role()
TO authenticated, service_role;
