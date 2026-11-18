-- Atomic CRM opportunity and expansion-site writes with optimistic concurrency.
CREATE OR REPLACE FUNCTION public.create_crm_opportunity_with_event(p_actor_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v public.crm_opportunities%ROWTYPE;
BEGIN
 SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true FOR SHARE;
 IF NOT FOUND OR v_actor.role<>'admin' THEN RAISE EXCEPTION 'unauthorized_actor' USING ERRCODE='42501'; END IF;
 IF p_payload ? 'assigned_to' AND p_payload->>'assigned_to' IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.funcionarios WHERE id=(p_payload->>'assigned_to')::uuid AND ativo=true
 ) THEN RAISE EXCEPTION 'invalid_assignee' USING ERRCODE='22023'; END IF;
 INSERT INTO public.crm_opportunities(
  title,opportunity_type,stage,priority,expected_value,location,contact_name,contact_email,contact_phone,
  assigned_to,next_action,next_action_at,notes,created_by,closed_at
 ) VALUES (
  p_payload->>'title',p_payload->>'opportunity_type',coalesce(p_payload->>'stage','lead'),
  coalesce(p_payload->>'priority','normal'),nullif(p_payload->>'expected_value','')::numeric,
  p_payload->>'location',p_payload->>'contact_name',p_payload->>'contact_email',p_payload->>'contact_phone',
  nullif(p_payload->>'assigned_to','')::uuid,p_payload->>'next_action',
  nullif(p_payload->>'next_action_at','')::timestamptz,coalesce(p_payload->>'notes',''),p_actor_id,
  nullif(p_payload->>'closed_at','')::timestamptz
 ) RETURNING * INTO v;
 INSERT INTO public.crm_opportunity_events(opportunity_id,actor_id,action,old_values,new_values)
 VALUES(v.id,p_actor_id,'created',NULL,to_jsonb(v));
 RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.update_crm_opportunity_with_event(
 p_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v_old public.crm_opportunities%ROWTYPE; v public.crm_opportunities%ROWTYPE; v_action text;
BEGIN
 SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true FOR SHARE;
 IF NOT FOUND OR v_actor.role<>'admin' THEN RAISE EXCEPTION 'unauthorized_actor' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM public.crm_opportunities WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found' USING ERRCODE='P0002'; END IF;
 IF v_old.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'stale_opportunity' USING ERRCODE='40001'; END IF;
 IF p_payload ? 'assigned_to' AND p_payload->>'assigned_to' IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.funcionarios WHERE id=(p_payload->>'assigned_to')::uuid AND ativo=true
 ) THEN RAISE EXCEPTION 'invalid_assignee' USING ERRCODE='22023'; END IF;
 UPDATE public.crm_opportunities SET
  title=CASE WHEN p_payload?'title' THEN p_payload->>'title' ELSE title END,
  opportunity_type=CASE WHEN p_payload?'opportunity_type' THEN p_payload->>'opportunity_type' ELSE opportunity_type END,
  stage=CASE WHEN p_payload?'stage' THEN p_payload->>'stage' ELSE stage END,
  priority=CASE WHEN p_payload?'priority' THEN p_payload->>'priority' ELSE priority END,
  expected_value=CASE WHEN p_payload?'expected_value' THEN nullif(p_payload->>'expected_value','')::numeric ELSE expected_value END,
  location=CASE WHEN p_payload?'location' THEN p_payload->>'location' ELSE location END,
  contact_name=CASE WHEN p_payload?'contact_name' THEN p_payload->>'contact_name' ELSE contact_name END,
  contact_email=CASE WHEN p_payload?'contact_email' THEN p_payload->>'contact_email' ELSE contact_email END,
  contact_phone=CASE WHEN p_payload?'contact_phone' THEN p_payload->>'contact_phone' ELSE contact_phone END,
  assigned_to=CASE WHEN p_payload?'assigned_to' THEN nullif(p_payload->>'assigned_to','')::uuid ELSE assigned_to END,
  next_action=CASE WHEN p_payload?'next_action' THEN p_payload->>'next_action' ELSE next_action END,
  next_action_at=CASE WHEN p_payload?'next_action_at' THEN nullif(p_payload->>'next_action_at','')::timestamptz ELSE next_action_at END,
  notes=CASE WHEN p_payload?'notes' THEN coalesce(p_payload->>'notes','') ELSE notes END,
  closed_at=CASE WHEN p_payload?'closed_at' THEN nullif(p_payload->>'closed_at','')::timestamptz ELSE closed_at END,
  updated_at=clock_timestamp()
 WHERE id=p_id RETURNING * INTO v;
 v_action:=CASE WHEN v.assigned_to IS DISTINCT FROM v_old.assigned_to THEN 'reassigned'
                WHEN v.stage IS DISTINCT FROM v_old.stage THEN 'stage_changed' ELSE 'updated' END;
 INSERT INTO public.crm_opportunity_events(opportunity_id,actor_id,action,old_values,new_values)
 VALUES(v.id,p_actor_id,v_action,to_jsonb(v_old),to_jsonb(v));
 RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.create_crm_expansion_site_with_event(p_actor_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v public.crm_expansion_sites%ROWTYPE;
BEGIN
 SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true FOR SHARE;
 IF NOT FOUND OR v_actor.role<>'admin' THEN RAISE EXCEPTION 'unauthorized_actor' USING ERRCODE='42501'; END IF;
 INSERT INTO public.crm_expansion_sites(
  opportunity_id,name,address,city,district,latitude,longitude,area_sqm,monthly_rent,estimated_setup_cost,
  estimated_monthly_revenue,estimated_monthly_other_costs,estimated_initial_stock,
  estimated_monthly_staff_cost,estimated_monthly_utilities_cost,
  footfall_score,visibility_score,accessibility_score,competition_score,security_score,parking_score,fit_score,
  status,notes,created_by
 ) VALUES (
  nullif(p_payload->>'opportunity_id','')::uuid,p_payload->>'name',p_payload->>'address',p_payload->>'city',
  p_payload->>'district',nullif(p_payload->>'latitude','')::numeric,nullif(p_payload->>'longitude','')::numeric,
  nullif(p_payload->>'area_sqm','')::numeric,nullif(p_payload->>'monthly_rent','')::numeric,
  nullif(p_payload->>'estimated_setup_cost','')::numeric,nullif(p_payload->>'estimated_monthly_revenue','')::numeric,
  nullif(p_payload->>'estimated_monthly_other_costs','')::numeric,nullif(p_payload->>'estimated_initial_stock','')::numeric,
  coalesce(nullif(p_payload->>'estimated_monthly_staff_cost','')::numeric,0),
  coalesce(nullif(p_payload->>'estimated_monthly_utilities_cost','')::numeric,0),
  coalesce((p_payload->>'footfall_score')::smallint,3),coalesce((p_payload->>'visibility_score')::smallint,3),
  coalesce((p_payload->>'accessibility_score')::smallint,3),coalesce((p_payload->>'competition_score')::smallint,3),
  coalesce((p_payload->>'security_score')::smallint,3),coalesce((p_payload->>'parking_score')::smallint,3),
  coalesce((p_payload->>'fit_score')::smallint,3),coalesce(p_payload->>'status','em_avaliacao'),
  coalesce(p_payload->>'notes',''),p_actor_id
 ) RETURNING * INTO v;
 INSERT INTO public.crm_expansion_site_events(site_id,actor_id,action,old_values,new_values)
 VALUES(v.id,p_actor_id,'created',NULL,to_jsonb(v));
 RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.update_crm_expansion_site_with_event(
 p_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v_old public.crm_expansion_sites%ROWTYPE; v public.crm_expansion_sites%ROWTYPE; v_action text;
BEGIN
 SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true FOR SHARE;
 IF NOT FOUND OR v_actor.role<>'admin' THEN RAISE EXCEPTION 'unauthorized_actor' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_old FROM public.crm_expansion_sites WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'site_not_found' USING ERRCODE='P0002'; END IF;
 IF v_old.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'stale_site' USING ERRCODE='40001'; END IF;
 UPDATE public.crm_expansion_sites SET
  opportunity_id=CASE WHEN p_payload?'opportunity_id' THEN nullif(p_payload->>'opportunity_id','')::uuid ELSE opportunity_id END,
  name=CASE WHEN p_payload?'name' THEN p_payload->>'name' ELSE name END,
  address=CASE WHEN p_payload?'address' THEN p_payload->>'address' ELSE address END,
  city=CASE WHEN p_payload?'city' THEN p_payload->>'city' ELSE city END,
  district=CASE WHEN p_payload?'district' THEN p_payload->>'district' ELSE district END,
  latitude=CASE WHEN p_payload?'latitude' THEN nullif(p_payload->>'latitude','')::numeric ELSE latitude END,
  longitude=CASE WHEN p_payload?'longitude' THEN nullif(p_payload->>'longitude','')::numeric ELSE longitude END,
  area_sqm=CASE WHEN p_payload?'area_sqm' THEN nullif(p_payload->>'area_sqm','')::numeric ELSE area_sqm END,
  monthly_rent=CASE WHEN p_payload?'monthly_rent' THEN nullif(p_payload->>'monthly_rent','')::numeric ELSE monthly_rent END,
  estimated_setup_cost=CASE WHEN p_payload?'estimated_setup_cost' THEN nullif(p_payload->>'estimated_setup_cost','')::numeric ELSE estimated_setup_cost END,
  estimated_monthly_revenue=CASE WHEN p_payload?'estimated_monthly_revenue' THEN nullif(p_payload->>'estimated_monthly_revenue','')::numeric ELSE estimated_monthly_revenue END,
  estimated_monthly_other_costs=CASE WHEN p_payload?'estimated_monthly_other_costs' THEN nullif(p_payload->>'estimated_monthly_other_costs','')::numeric ELSE estimated_monthly_other_costs END,
  estimated_initial_stock=CASE WHEN p_payload?'estimated_initial_stock' THEN nullif(p_payload->>'estimated_initial_stock','')::numeric ELSE estimated_initial_stock END,
  estimated_monthly_staff_cost=CASE WHEN p_payload?'estimated_monthly_staff_cost' THEN (p_payload->>'estimated_monthly_staff_cost')::numeric ELSE estimated_monthly_staff_cost END,
  estimated_monthly_utilities_cost=CASE WHEN p_payload?'estimated_monthly_utilities_cost' THEN (p_payload->>'estimated_monthly_utilities_cost')::numeric ELSE estimated_monthly_utilities_cost END,
  footfall_score=CASE WHEN p_payload?'footfall_score' THEN (p_payload->>'footfall_score')::smallint ELSE footfall_score END,
  visibility_score=CASE WHEN p_payload?'visibility_score' THEN (p_payload->>'visibility_score')::smallint ELSE visibility_score END,
  accessibility_score=CASE WHEN p_payload?'accessibility_score' THEN (p_payload->>'accessibility_score')::smallint ELSE accessibility_score END,
  competition_score=CASE WHEN p_payload?'competition_score' THEN (p_payload->>'competition_score')::smallint ELSE competition_score END,
  security_score=CASE WHEN p_payload?'security_score' THEN (p_payload->>'security_score')::smallint ELSE security_score END,
  parking_score=CASE WHEN p_payload?'parking_score' THEN (p_payload->>'parking_score')::smallint ELSE parking_score END,
  fit_score=CASE WHEN p_payload?'fit_score' THEN (p_payload->>'fit_score')::smallint ELSE fit_score END,
  status=CASE WHEN p_payload?'status' THEN p_payload->>'status' ELSE status END,
  notes=CASE WHEN p_payload?'notes' THEN coalesce(p_payload->>'notes','') ELSE notes END,
  updated_at=clock_timestamp()
 WHERE id=p_id RETURNING * INTO v;
 v_action:=CASE WHEN v.status IS DISTINCT FROM v_old.status THEN 'status_changed' ELSE 'updated' END;
 INSERT INTO public.crm_expansion_site_events(site_id,actor_id,action,old_values,new_values)
 VALUES(v.id,p_actor_id,v_action,to_jsonb(v_old),to_jsonb(v));
 RETURN to_jsonb(v);
END $$;

REVOKE ALL ON FUNCTION public.create_crm_opportunity_with_event(uuid,jsonb),
 public.update_crm_opportunity_with_event(uuid,uuid,timestamptz,jsonb),
 public.create_crm_expansion_site_with_event(uuid,jsonb),
 public.update_crm_expansion_site_with_event(uuid,uuid,timestamptz,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_crm_opportunity_with_event(uuid,jsonb),
 public.update_crm_opportunity_with_event(uuid,uuid,timestamptz,jsonb),
 public.create_crm_expansion_site_with_event(uuid,jsonb),
 public.update_crm_expansion_site_with_event(uuid,uuid,timestamptz,jsonb)
 TO service_role;
