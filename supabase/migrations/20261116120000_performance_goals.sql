-- Monthly and custom-period performance goals for stores and employees.
CREATE TABLE IF NOT EXISTS public.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('loja','funcionario')),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE RESTRICT,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  metric text NOT NULL CHECK (metric IN ('volume_eur','peso_ouro_g','transacoes')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 140),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  target_value numeric(16,3) NOT NULL CHECK (target_value > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_goals_scope_target_check CHECK (
    (scope_type = 'loja' AND loja_id IS NOT NULL AND funcionario_id IS NULL) OR
    (scope_type = 'funcionario' AND funcionario_id IS NOT NULL AND loja_id IS NULL)
  ),
  CONSTRAINT performance_goals_period_check CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS performance_goals_store_period_idx
  ON public.performance_goals(loja_id, period_start, period_end) WHERE scope_type = 'loja';
CREATE INDEX IF NOT EXISTS performance_goals_employee_period_idx
  ON public.performance_goals(funcionario_id, period_start, period_end) WHERE scope_type = 'funcionario';
CREATE INDEX IF NOT EXISTS performance_goals_created_idx
  ON public.performance_goals(created_at DESC);

CREATE TABLE IF NOT EXISTS public.performance_goal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.performance_goals(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created','updated')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS performance_goal_events_goal_created_idx
  ON public.performance_goal_events(goal_id, created_at DESC);

ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_goal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.performance_goals, public.performance_goal_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.performance_goals, public.performance_goal_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_performance_goal_progress(p_goal_id uuid)
RETURNS TABLE(actual_value numeric, transaction_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    CASE g.metric
      WHEN 'volume_eur' THEN COALESCE(SUM(t.valor_final), 0)
      WHEN 'peso_ouro_g' THEN COALESCE(SUM(t.peso_gramas), 0)
      WHEN 'transacoes' THEN COUNT(t.id)::numeric
      ELSE 0
    END AS actual_value,
    COUNT(t.id)::bigint AS transaction_count
  FROM public.performance_goals g
  LEFT JOIN public.transacoes t
    ON t.estado = 'aprovado'
   AND t.created_at >= (g.period_start::timestamp AT TIME ZONE 'Europe/Lisbon')
   AND t.created_at < ((g.period_end + 1)::timestamp AT TIME ZONE 'Europe/Lisbon')
   AND (g.scope_type <> 'loja' OR t.loja_id = g.loja_id)
   AND (g.scope_type <> 'funcionario' OR t.funcionario_id = g.funcionario_id)
  WHERE g.id = p_goal_id
  GROUP BY g.metric;
$$;
REVOKE ALL ON FUNCTION public.get_performance_goal_progress(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_goal_progress(uuid) TO service_role;

ALTER TABLE public.collab_notifications DROP CONSTRAINT IF EXISTS collab_notifications_kind_check;
ALTER TABLE public.collab_notifications ADD CONSTRAINT collab_notifications_kind_check
  CHECK (kind IN ('report_created','report_updated','report_comment','chat_message','task_assigned','task_updated','goal_assigned','goal_updated','opportunity_assigned','opportunity_updated'));
