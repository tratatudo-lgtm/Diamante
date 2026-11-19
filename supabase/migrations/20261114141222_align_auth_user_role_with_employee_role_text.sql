-- Keep the role lookup aligned with public.funcionarios.role, which is TEXT.
-- The existing storage policy only needs an active employee check, not a role lookup.
DROP POLICY IF EXISTS "Permitir upload de fotos por funcionários ativos" ON storage.objects;

CREATE POLICY "Permitir upload de fotos por funcionários ativos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos-artigos'
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios AS f
    WHERE f.id = (SELECT auth.uid())
      AND f.ativo = true
  )
);

DROP FUNCTION public.get_auth_user_role();

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
