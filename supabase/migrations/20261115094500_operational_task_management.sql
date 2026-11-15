-- Operational task management with immutable status/assignment history.
CREATE TABLE IF NOT EXISTS public.operational_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 5 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 6000),
  status text NOT NULL DEFAULT 'por_fazer' CHECK (status IN ('por_fazer','em_curso','bloqueada','concluida')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  assigned_to uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operational_tasks_assignee_status_due_idx
  ON public.operational_tasks(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS operational_tasks_store_status_idx
  ON public.operational_tasks(loja_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS operational_tasks_created_by_idx
  ON public.operational_tasks(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.operational_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.operational_tasks(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created','updated','status_changed','reassigned')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operational_task_events_task_created_idx
  ON public.operational_task_events(task_id, created_at DESC);

ALTER TABLE public.operational_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_task_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operational_tasks, public.operational_task_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.operational_tasks, public.operational_task_events TO service_role;
