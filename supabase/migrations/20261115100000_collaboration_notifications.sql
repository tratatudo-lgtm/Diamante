CREATE TABLE IF NOT EXISTS public.collab_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('report_created','report_updated','report_comment','chat_message')),
  entity_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_notifications_employee_unread_idx
  ON public.collab_notifications(funcionario_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS collab_notifications_employee_created_idx
  ON public.collab_notifications(funcionario_id, created_at DESC);
ALTER TABLE public.collab_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.collab_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.collab_notifications TO service_role;
