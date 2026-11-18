-- Record employee report comments and their audit event atomically.
CREATE OR REPLACE FUNCTION public.create_collab_report_comment_with_event(
  p_report_id uuid,
  p_actor_id uuid,
  p_comment text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_report public.collab_reports%ROWTYPE;
  v_comment public.collab_report_comments%ROWTYPE;
  v_employee public.funcionarios%ROWTYPE;
BEGIN
  IF p_comment IS NULL OR char_length(trim(p_comment)) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'invalid_comment' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_employee
  FROM public.funcionarios
  WHERE id=p_actor_id AND ativo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'inactive_or_missing_actor' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_report
  FROM public.collab_reports
  WHERE id=p_report_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report_not_found' USING ERRCODE='P0002'; END IF;

  IF v_employee.role <> 'admin'
     AND v_report.reporter_id <> p_actor_id
     AND v_report.assigned_to IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'not_authorized_for_report' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.collab_report_comments(report_id,funcionario_id,comentario,interno)
  VALUES (p_report_id,p_actor_id,trim(p_comment),false)
  RETURNING * INTO v_comment;

  INSERT INTO public.collab_report_events(report_id,actor_id,action,old_values,new_values)
  VALUES (p_report_id,p_actor_id,'commented','{}'::jsonb,
    jsonb_build_object('comment_id',v_comment.id,'interno',false));

  RETURN to_jsonb(v_comment) || jsonb_build_object(
    'funcionarios',jsonb_build_object(
      'nome_completo',v_employee.nome_completo,
      'role',v_employee.role
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_collab_report_comment_with_event(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_collab_report_comment_with_event(uuid,uuid,text) TO service_role;
