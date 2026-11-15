-- Commercial opportunity pipeline: partners, investors and store expansion.
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  opportunity_type text NOT NULL CHECK (opportunity_type IN ('parceria','investidor','nova_loja','fornecedor','outro')),
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','contactado','qualificacao','proposta','negociacao','ganha','perdida')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  expected_value numeric(14,2) CHECK (expected_value IS NULL OR expected_value >= 0),
  location text CHECK (location IS NULL OR char_length(location) <= 240),
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 160),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40),
  assigned_to uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  next_action text CHECK (next_action IS NULL OR char_length(next_action) <= 1000),
  next_action_at timestamptz,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 8000),
  created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS crm_opportunities_stage_updated_idx ON public.crm_opportunities(stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_opportunities_assignee_stage_idx ON public.crm_opportunities(assigned_to, stage, next_action_at);
CREATE INDEX IF NOT EXISTS crm_opportunities_type_created_idx ON public.crm_opportunities(opportunity_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_opportunity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created','updated','stage_changed','reassigned')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_opportunity_events_history_idx ON public.crm_opportunity_events(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_opportunity_events_actor_idx ON public.crm_opportunity_events(actor_id);

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_opportunities, public.crm_opportunity_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.crm_opportunities, public.crm_opportunity_events TO service_role;

ALTER TABLE public.collab_notifications DROP CONSTRAINT IF EXISTS collab_notifications_kind_check;
ALTER TABLE public.collab_notifications ADD CONSTRAINT collab_notifications_kind_check
  CHECK (kind = ANY (ARRAY[
    'report_created','report_updated','report_comment','chat_message',
    'task_assigned','task_updated','goal_assigned','goal_updated',
    'opportunity_assigned','opportunity_updated'
  ]::text[]));
