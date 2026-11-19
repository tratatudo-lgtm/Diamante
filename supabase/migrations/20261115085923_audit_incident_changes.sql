-- Auditable, atomic incident management history.
CREATE TABLE IF NOT EXISTS public.collab_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.collab_reports(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'commented')),
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_report_events_report_created_idx
  ON public.collab_report_events(report_id, created_at DESC);
ALTER TABLE public.collab_report_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.collab_report_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.collab_report_events TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_collab_report(
  p_report_id uuid, p_actor_id uuid, p_changes jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_old public.collab_reports%ROWTYPE;
  v_new public.collab_reports%ROWTYPE;
  v_assignee uuid;
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = p_actor_id AND f.ativo = true AND f.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object'
     OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                WHERE k NOT IN ('estado','prioridade','assigned_to')) THEN
    RAISE EXCEPTION 'invalid_changes' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.collab_reports
  WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_changes ? 'estado' THEN
    IF p_changes->>'estado' NOT IN ('novo','em_analise','em_resolucao','aguarda_informacao','resolvido','fechado') THEN
      RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
    END IF;
    v_old_values := v_old_values || jsonb_build_object('estado', v_old.estado);
    v_new_values := v_new_values || jsonb_build_object('estado', p_changes->>'estado');
    v_new.estado := p_changes->>'estado';
    v_new.resolved_at := CASE WHEN v_new.estado IN ('resolvido','fechado') THEN now() ELSE NULL END;
  ELSE
    v_new.estado := v_old.estado;
    v_new.resolved_at := v_old.resolved_at;
  END IF;

  IF p_changes ? 'prioridade' THEN
    IF p_changes->>'prioridade' NOT IN ('baixa','normal','alta','urgente') THEN
      RAISE EXCEPTION 'invalid_priority' USING ERRCODE = '22023';
    END IF;
    v_old_values := v_old_values || jsonb_build_object('prioridade', v_old.prioridade);
    v_new_values := v_new_values || jsonb_build_object('prioridade', p_changes->>'prioridade');
    v_new.prioridade := p_changes->>'prioridade';
  ELSE
    v_new.prioridade := v_old.prioridade;
  END IF;

  IF p_changes ? 'assigned_to' THEN
    IF p_changes->'assigned_to' <> 'null'::jsonb THEN
      BEGIN v_assignee := (p_changes->>'assigned_to')::uuid;
      EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid_assignee' USING ERRCODE = '22023'; END;
      IF NOT EXISTS (SELECT 1 FROM public.funcionarios f WHERE f.id = v_assignee AND f.ativo = true) THEN
        RAISE EXCEPTION 'invalid_assignee' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_assignee := NULL;
    END IF;
    v_old_values := v_old_values || jsonb_build_object('assigned_to', v_old.assigned_to);
    v_new_values := v_new_values || jsonb_build_object('assigned_to', v_assignee);
    v_new.assigned_to := v_assignee;
  ELSE
    v_new.assigned_to := v_old.assigned_to;
  END IF;

  UPDATE public.collab_reports SET
    estado = v_new.estado, prioridade = v_new.prioridade,
    assigned_to = v_new.assigned_to, resolved_at = v_new.resolved_at,
    updated_at = now()
  WHERE id = p_report_id
  RETURNING * INTO v_new;

  INSERT INTO public.collab_report_events(report_id, actor_id, action, old_values, new_values)
  VALUES (p_report_id, p_actor_id, 'updated', v_old_values, v_new_values);

  RETURN jsonb_build_object('id', v_new.id, 'reference', v_new.reference,
    'estado', v_new.estado, 'prioridade', v_new.prioridade,
    'assigned_to', v_new.assigned_to, 'reporter_id', v_new.reporter_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_collab_report(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_collab_report(uuid, uuid, jsonb) TO service_role;
