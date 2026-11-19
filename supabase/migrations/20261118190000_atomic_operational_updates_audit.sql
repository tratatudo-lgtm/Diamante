-- Atomic updates and audit events for tasks and goals.
CREATE OR REPLACE FUNCTION public.update_operational_task_with_event(
  p_task_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz, p_changes jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_task public.operational_tasks%ROWTYPE;
  v_updated public.operational_tasks%ROWTYPE;
  v_actor public.funcionarios%ROWTYPE;
  v_action text;
BEGIN
  SELECT * INTO v_actor FROM public.funcionarios
  WHERE id=p_actor_id AND ativo=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_task FROM public.operational_tasks
  WHERE id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF v_task.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'stale_task' USING ERRCODE='40001';
  END IF;

  IF v_actor.role <> 'admin' THEN
    IF v_task.assigned_to <> p_actor_id
      OR p_changes - ARRAY['status']::text[] <> '{}'::jsonb
      OR p_changes->>'status' NOT IN ('por_fazer','em_curso','concluida') THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_changes) AS keys(key)
    WHERE key NOT IN ('title','description','priority','assigned_to','due_at','status')
  ) THEN RAISE EXCEPTION 'invalid_changes' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'title' AND char_length(trim(p_changes->>'title')) NOT BETWEEN 5 AND 160
    THEN RAISE EXCEPTION 'invalid_title' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'description' AND char_length(p_changes->>'description') > 6000
    THEN RAISE EXCEPTION 'invalid_description' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'priority' AND p_changes->>'priority' NOT IN ('baixa','normal','alta','urgente')
    THEN RAISE EXCEPTION 'invalid_priority' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'status' AND p_changes->>'status' NOT IN ('por_fazer','em_curso','bloqueada','concluida')
    THEN RAISE EXCEPTION 'invalid_status' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'assigned_to' AND p_changes->>'assigned_to' IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id=(p_changes->>'assigned_to')::uuid AND f.ativo=true
  ) THEN RAISE EXCEPTION 'invalid_assignee' USING ERRCODE='22023'; END IF;

  UPDATE public.operational_tasks SET
    title=CASE WHEN p_changes ? 'title' THEN p_changes->>'title' ELSE title END,
    description=CASE WHEN p_changes ? 'description' THEN p_changes->>'description' ELSE description END,
    priority=CASE WHEN p_changes ? 'priority' THEN p_changes->>'priority' ELSE priority END,
    status=CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE status END,
    assigned_to=CASE WHEN p_changes ? 'assigned_to' THEN (p_changes->>'assigned_to')::uuid ELSE assigned_to END,
    loja_id=CASE WHEN p_changes ? 'assigned_to' THEN
      (SELECT f.loja_id FROM public.funcionarios f WHERE f.id=(p_changes->>'assigned_to')::uuid)
      ELSE loja_id END,
    due_at=CASE WHEN p_changes ? 'due_at' THEN NULLIF(p_changes->>'due_at','')::timestamptz ELSE due_at END,
    completed_at=CASE WHEN p_changes ? 'status' THEN
      CASE WHEN p_changes->>'status'='concluida' THEN now() ELSE NULL END
      ELSE completed_at END,
    updated_at=now()
  WHERE id=p_task_id RETURNING * INTO v_updated;

  v_action := CASE
    WHEN v_updated.assigned_to IS DISTINCT FROM v_task.assigned_to THEN 'reassigned'
    WHEN v_updated.status IS DISTINCT FROM v_task.status THEN 'status_changed'
    ELSE 'updated' END;
  INSERT INTO public.operational_task_events(task_id,actor_id,action,old_values,new_values)
  VALUES (p_task_id,p_actor_id,v_action,to_jsonb(v_task),to_jsonb(v_updated));
  RETURN to_jsonb(v_updated);
END;
$$;
REVOKE ALL ON FUNCTION public.update_operational_task_with_event(uuid,uuid,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_operational_task_with_event(uuid,uuid,timestamptz,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.update_operational_goal_with_event(
  p_goal_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz, p_changes jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_goal public.operational_goals%ROWTYPE;
  v_updated public.operational_goals%ROWTYPE;
  v_actor public.funcionarios%ROWTYPE;
  v_action text;
BEGIN
  SELECT * INTO v_actor FROM public.funcionarios
  WHERE id=p_actor_id AND ativo=true AND role='admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_goal FROM public.operational_goals
  WHERE id=p_goal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF v_goal.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'stale_goal' USING ERRCODE='40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_changes) k
    WHERE k NOT IN ('title','description','target_value','status','starts_on','ends_on')
  ) THEN RAISE EXCEPTION 'invalid_changes' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'title' AND char_length(trim(p_changes->>'title')) NOT BETWEEN 5 AND 160
    THEN RAISE EXCEPTION 'invalid_title' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'description' AND char_length(p_changes->>'description') > 4000
    THEN RAISE EXCEPTION 'invalid_description' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'target_value' AND ((p_changes->>'target_value')::numeric <= 0 OR (p_changes->>'target_value')::numeric > 1e12)
    THEN RAISE EXCEPTION 'invalid_target' USING ERRCODE='22023'; END IF;
  IF p_changes ? 'status' AND p_changes->>'status' NOT IN ('activa','suspensa','concluida')
    THEN RAISE EXCEPTION 'invalid_status' USING ERRCODE='22023'; END IF;

  UPDATE public.operational_goals SET
    title=CASE WHEN p_changes ? 'title' THEN p_changes->>'title' ELSE title END,
    description=CASE WHEN p_changes ? 'description' THEN p_changes->>'description' ELSE description END,
    target_value=CASE WHEN p_changes ? 'target_value' THEN (p_changes->>'target_value')::numeric ELSE target_value END,
    status=CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE status END,
    starts_on=CASE WHEN p_changes ? 'starts_on' THEN (p_changes->>'starts_on')::date ELSE starts_on END,
    ends_on=CASE WHEN p_changes ? 'ends_on' THEN (p_changes->>'ends_on')::date ELSE ends_on END,
    updated_at=now()
  WHERE id=p_goal_id RETURNING * INTO v_updated;
  IF v_updated.ends_on < v_updated.starts_on THEN
    RAISE EXCEPTION 'invalid_date_range' USING ERRCODE='22023';
  END IF;
  v_action := CASE WHEN v_updated.status IS DISTINCT FROM v_goal.status THEN 'status_changed' ELSE 'updated' END;
  INSERT INTO public.operational_goal_events(goal_id,actor_id,action,old_values,new_values)
  VALUES (p_goal_id,p_actor_id,v_action,to_jsonb(v_goal),to_jsonb(v_updated));
  RETURN to_jsonb(v_updated);
END;
$$;
REVOKE ALL ON FUNCTION public.update_operational_goal_with_event(uuid,uuid,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_operational_goal_with_event(uuid,uuid,timestamptz,jsonb) TO service_role;
