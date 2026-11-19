-- Idempotently hoist auth.uid()/auth.jwt() calls in RLS expressions.
-- Sentinels prevent wrapping expressions that were already optimized.
DO $migration$
DECLARE
  p record;
  using_expr text;
  check_expr text;
  stmt text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ILIKE '%auth.uid()%'
        OR coalesce(with_check, '') ILIKE '%auth.uid()%'
        OR coalesce(qual, '') ILIKE '%auth.jwt()%'
        OR coalesce(with_check, '') ILIKE '%auth.jwt()%'
      )
  LOOP
    using_expr := p.qual;
    check_expr := p.with_check;

    IF using_expr IS NOT NULL THEN
      using_expr := replace(using_expr, '( SELECT auth.uid() AS uid)', '__DIAMANTE_AUTH_UID__');
      using_expr := replace(using_expr, '( SELECT auth.jwt() AS jwt)', '__DIAMANTE_AUTH_JWT__');
      using_expr := replace(using_expr, 'auth.uid()', '(select auth.uid())');
      using_expr := replace(using_expr, 'auth.jwt()', '(select auth.jwt())');
      using_expr := replace(using_expr, '__DIAMANTE_AUTH_UID__', '( SELECT auth.uid() AS uid)');
      using_expr := replace(using_expr, '__DIAMANTE_AUTH_JWT__', '( SELECT auth.jwt() AS jwt)');
    END IF;

    IF check_expr IS NOT NULL THEN
      check_expr := replace(check_expr, '( SELECT auth.uid() AS uid)', '__DIAMANTE_AUTH_UID__');
      check_expr := replace(check_expr, '( SELECT auth.jwt() AS jwt)', '__DIAMANTE_AUTH_JWT__');
      check_expr := replace(check_expr, 'auth.uid()', '(select auth.uid())');
      check_expr := replace(check_expr, 'auth.jwt()', '(select auth.jwt())');
      check_expr := replace(check_expr, '__DIAMANTE_AUTH_UID__', '( SELECT auth.uid() AS uid)');
      check_expr := replace(check_expr, '__DIAMANTE_AUTH_JWT__', '( SELECT auth.jwt() AS jwt)');
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF using_expr IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', using_expr);
    END IF;
    IF check_expr IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', check_expr);
    END IF;
    EXECUTE stmt;
  END LOOP;
END
$migration$;

-- Normalize the one policy that was already using a scalar subquery.
ALTER POLICY "Funcionarios leem o proprio perfil" ON public.funcionarios
  USING (id = (SELECT auth.uid()));
