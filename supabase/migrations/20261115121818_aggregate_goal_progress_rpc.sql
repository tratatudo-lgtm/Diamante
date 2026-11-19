CREATE OR REPLACE FUNCTION public.get_operational_goal_progress(p_goal_ids uuid[])
RETURNS TABLE(goal_id uuid, current_value numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    g.id,
    CASE
      WHEN g.metric = 'transacoes_aprovadas' THEN COUNT(t.id)::numeric
      WHEN g.metric = 'volume_aprovado' THEN COALESCE(SUM(t.valor_final), 0)::numeric
      WHEN g.metric = 'peso_aprovado_g' THEN COALESCE(SUM(t.peso_gramas), 0)::numeric
      ELSE 0::numeric
    END AS current_value
  FROM public.operational_goals AS g
  LEFT JOIN public.transacoes AS t
    ON t.estado = 'aprovado'
    AND t.created_at >= (g.starts_on::timestamp AT TIME ZONE 'Europe/Lisbon')
    AND t.created_at < ((g.ends_on + 1)::timestamp AT TIME ZONE 'Europe/Lisbon')
    AND (
      (g.scope = 'loja' AND t.loja_id = g.loja_id)
      OR
      (g.scope = 'funcionario' AND t.funcionario_id = g.funcionario_id)
    )
  WHERE g.id = ANY(p_goal_ids)
  GROUP BY g.id, g.metric;
$$;
REVOKE ALL ON FUNCTION public.get_operational_goal_progress(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_goal_progress(uuid[]) TO service_role;
