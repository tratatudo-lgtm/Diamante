-- Atomic creation of operational records and their mandatory audit event.
-- Only the backend service role may invoke these SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION public.create_operational_task_with_event(
  p_title text, p_description text, p_assigned_to uuid, p_created_by uuid,
  p_loja_id uuid, p_priority text, p_due_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_task public.operational_tasks%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios f
    WHERE f.id=p_created_by AND f.ativo=true AND f.role='admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios f
    WHERE f.id=p_assigned_to AND f.ativo=true) THEN
    RAISE EXCEPTION 'invalid_assignee' USING ERRCODE='22023';
  END IF;
  IF p_loja_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id=p_assigned_to AND (f.loja_id IS NULL OR f.loja_id=p_loja_id)
  ) THEN
    RAISE EXCEPTION 'assignee_store_mismatch' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.operational_tasks(
    title,description,assigned_to,created_by,loja_id,priority,due_at
  ) VALUES (
    p_title,COALESCE(p_description,''),p_assigned_to,p_created_by,p_loja_id,
    COALESCE(p_priority,'normal'),p_due_at
  ) RETURNING * INTO v_task;

  INSERT INTO public.operational_task_events(task_id,actor_id,action,new_values)
  VALUES (v_task.id,p_created_by,'created',to_jsonb(v_task));

  RETURN to_jsonb(v_task);
END;
$$;
REVOKE ALL ON FUNCTION public.create_operational_task_with_event(text,text,uuid,uuid,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_operational_task_with_event(text,text,uuid,uuid,uuid,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.create_operational_goal_with_event(
  p_title text, p_description text, p_scope text, p_metric text,
  p_target_value numeric, p_loja_id uuid, p_funcionario_id uuid,
  p_starts_on date, p_ends_on date, p_created_by uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_goal public.operational_goals%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios f
    WHERE f.id=p_created_by AND f.ativo=true AND f.role='admin') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_scope='loja' THEN
    IF p_loja_id IS NULL OR p_funcionario_id IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM public.lojas l WHERE l.id=p_loja_id AND l.ativo=true
    ) THEN RAISE EXCEPTION 'invalid_goal_target' USING ERRCODE='22023'; END IF;
  ELSIF p_scope='funcionario' THEN
    IF p_funcionario_id IS NULL OR p_loja_id IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM public.funcionarios f WHERE f.id=p_funcionario_id AND f.ativo=true
    ) THEN RAISE EXCEPTION 'invalid_goal_target' USING ERRCODE='22023'; END IF;
  ELSE
    RAISE EXCEPTION 'invalid_goal_scope' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.operational_goals(
    title,description,scope,metric,target_value,loja_id,funcionario_id,
    starts_on,ends_on,created_by
  ) VALUES (
    p_title,COALESCE(p_description,''),p_scope,p_metric,p_target_value,
    p_loja_id,p_funcionario_id,p_starts_on,p_ends_on,p_created_by
  ) RETURNING * INTO v_goal;

  INSERT INTO public.operational_goal_events(goal_id,actor_id,action,new_values)
  VALUES (v_goal.id,p_created_by,'created',to_jsonb(v_goal));

  RETURN to_jsonb(v_goal);
END;
$$;
REVOKE ALL ON FUNCTION public.create_operational_goal_with_event(text,text,text,text,numeric,uuid,uuid,date,date,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_operational_goal_with_event(text,text,text,text,numeric,uuid,uuid,date,date,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_collab_report_with_event(
  p_title text, p_description text, p_category text,
  p_priority text, p_reporter_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_report public.collab_reports%ROWTYPE;
DECLARE v_store_id uuid;
BEGIN
  SELECT f.loja_id INTO v_store_id FROM public.funcionarios f
  WHERE f.id=p_reporter_id AND f.ativo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  INSERT INTO public.collab_reports(
    titulo,descricao,categoria,prioridade,reporter_id,loja_id
  ) VALUES (
    p_title,p_description,p_category,p_priority,p_reporter_id,v_store_id
  ) RETURNING * INTO v_report;

  INSERT INTO public.collab_report_events(
    report_id,actor_id,action,old_values,new_values
  ) VALUES (
    v_report.id,p_reporter_id,'created','{}'::jsonb,
    jsonb_build_object('titulo',v_report.titulo,'categoria',v_report.categoria,
      'prioridade',v_report.prioridade,'estado',v_report.estado)
  );

  RETURN to_jsonb(v_report);
END;
$$;
REVOKE ALL ON FUNCTION public.create_collab_report_with_event(text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_collab_report_with_event(text,text,text,text,uuid) TO service_role;
