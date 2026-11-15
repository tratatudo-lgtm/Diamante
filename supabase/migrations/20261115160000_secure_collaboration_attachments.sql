-- Private evidence attachments for employee incident reports.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('collab-attachments', 'collab-attachments', false, 6291456,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 6291456,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.collab_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.collab_reports(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 180),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 6291456),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_report_attachments_report_created_idx
  ON public.collab_report_attachments(report_id, created_at DESC);
ALTER TABLE public.collab_report_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.collab_report_attachments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.collab_report_attachments TO service_role;
