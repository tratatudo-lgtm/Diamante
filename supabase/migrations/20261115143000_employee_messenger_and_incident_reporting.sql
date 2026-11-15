-- Internal employee messaging and operational incident reporting.
CREATE TABLE IF NOT EXISTS public.collab_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('directa', 'grupo')),
  titulo text,
  criada_por uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_group_title_required CHECK (tipo <> 'grupo' OR (titulo IS NOT NULL AND length(trim(titulo)) BETWEEN 2 AND 100))
);

CREATE TABLE IF NOT EXISTS public.collab_conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.collab_conversations(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('criador', 'membro')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, funcionario_id)
);

CREATE TABLE IF NOT EXISTS public.collab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.collab_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.collab_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text GENERATED ALWAYS AS ('DD-' || upper(substr(replace(id::text, '-', ''), 1, 8))) STORED,
  titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 5 AND 140),
  descricao text NOT NULL CHECK (length(trim(descricao)) BETWEEN 10 AND 8000),
  categoria text NOT NULL CHECK (categoria IN ('sistema', 'equipamento', 'caixa', 'inventario', 'operacao', 'seguranca', 'sugestao', 'outro')),
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  estado text NOT NULL DEFAULT 'novo' CHECK (estado IN ('novo', 'em_analise', 'em_resolucao', 'aguarda_informacao', 'resolvido', 'fechado')),
  reporter_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.collab_report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.collab_reports(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  comentario text NOT NULL CHECK (length(trim(comentario)) BETWEEN 1 AND 4000),
  interno boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_members_employee_idx ON public.collab_conversation_members(funcionario_id, conversation_id);
CREATE INDEX IF NOT EXISTS collab_messages_conversation_created_idx ON public.collab_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_reports_reporter_created_idx ON public.collab_reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_reports_status_priority_idx ON public.collab_reports(estado, prioridade, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_reports_store_idx ON public.collab_reports(loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_comments_report_created_idx ON public.collab_report_comments(report_id, created_at);

ALTER TABLE public.collab_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_report_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.collab_conversations, public.collab_conversation_members, public.collab_messages, public.collab_reports, public.collab_report_comments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.collab_conversations, public.collab_conversation_members, public.collab_messages, public.collab_reports, public.collab_report_comments TO service_role;

