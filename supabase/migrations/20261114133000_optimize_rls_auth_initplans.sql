-- Hoist auth.uid()/auth.jwt() calls out of per-row RLS evaluation.
-- Wrapping these stable request-scoped values in scalar SELECTs lets
-- PostgreSQL evaluate them as initplans while preserving policy semantics.
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
      using_expr := regexp_replace(using_expr, 'auth\\.uid\\(\\)', '(select auth.uid())', 'gi');
      using_expr := regexp_replace(using_expr, 'auth\\.jwt\\(\\)', '(select auth.jwt())', 'gi');
    END IF;

    IF check_expr IS NOT NULL THEN
      check_expr := regexp_replace(check_expr, 'auth\\.uid\\(\\)', '(select auth.uid())', 'gi');
      check_expr := regexp_replace(check_expr, 'auth\\.jwt\\(\\)', '(select auth.jwt())', 'gi');
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
