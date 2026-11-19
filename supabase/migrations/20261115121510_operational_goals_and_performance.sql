-- Measurable goals for stores and employees; progress is derived from approved transactions only.
CREATE TABLE IF NOT EXISTS public.operational_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 5 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  scope text NOT NULL CHECK (scope IN ('loja','funcionario')),
  metric text NOT NULL CHECK (metric IN ('transacoes_aprovadas','volume_aprovado','peso_aprovado_g')),
  target_value numeric(18,3) NOT NULL CHECK (target_value > 0),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE RESTRICT,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','suspensa','concluida')),
  created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_goals_scope_target_check CHECK (
    (scope = 'loja' AND loja_id IS NOT NULL AND funcionario_id IS NULL) OR
    (scope = 'funcionario' AND funcionario_id IS NOT NULL AND loja_id IS NULL)
  ),
  CONSTRAINT operational_goals_dates_check CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS operational_goals_store_period_idx
  ON public.operational_goals(loja_id, starts_on, ends_on, status) WHERE scope='loja';
CREATE INDEX IF NOT EXISTS operational_goals_employee_period_idx
  ON public.operational_goals(funcionario_id, starts_on, ends_on, status) WHERE scope='funcionario';
CREATE INDEX IF NOT EXISTS operational_goals_status_period_idx
  ON public.operational_goals(status, starts_on, ends_on);

CREATE TABLE IF NOT EXISTS public.operational_goal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.operational_goals(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created','updated','status_changed')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operational_goal_events_goal_created_idx
  ON public.operational_goal_events(goal_id, created_at DESC);

ALTER TABLE public.operational_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_goal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operational_goals, public.operational_goal_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.operational_goals, public.operational_goal_events TO service_role;

ALTER TABLE public.collab_notifications DROP CONSTRAINT IF EXISTS collab_notifications_kind_check;
ALTER TABLE public.collab_notifications ADD CONSTRAINT collab_notifications_kind_check
  CHECK (kind IN ('report_created','report_updated','report_comment','chat_message','task_assigned','task_updated','goal_assigned','goal_updated'));
