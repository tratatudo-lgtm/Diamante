-- Keep conversation creation, membership and message activity updates atomic.
-- RPCs are backend-only; callers must still authenticate and authorize the request.
CREATE OR REPLACE FUNCTION public.create_collab_conversation_with_members(
  p_actor_id uuid,
  p_tipo text,
  p_titulo text,
  p_member_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_members uuid[];
  v_member_count integer;
  v_conversation public.collab_conversations%ROWTYPE;
  v_existing_id uuid;
BEGIN
  IF p_tipo NOT IN ('directa','grupo') THEN
    RAISE EXCEPTION 'invalid_conversation_type' USING ERRCODE='22023';
  END IF;
  IF p_member_ids IS NULL OR cardinality(p_member_ids) < 2 OR cardinality(p_member_ids) > 50 THEN
    RAISE EXCEPTION 'invalid_member_count' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(member_id ORDER BY member_id), count(DISTINCT member_id)
    INTO v_members, v_member_count
  FROM unnest(p_member_ids) AS member_id;
  IF v_member_count <> cardinality(p_member_ids) THEN
    RAISE EXCEPTION 'duplicate_members' USING ERRCODE='22023';
  END IF;
  IF NOT (p_actor_id = ANY(v_members)) THEN
    RAISE EXCEPTION 'actor_must_be_member' USING ERRCODE='22023';
  END IF;
  IF p_tipo='directa' AND cardinality(v_members) <> 2 THEN
    RAISE EXCEPTION 'direct_conversation_requires_two_members' USING ERRCODE='22023';
  END IF;
  IF p_tipo='grupo' AND (p_titulo IS NULL OR char_length(trim(p_titulo)) NOT BETWEEN 2 AND 100) THEN
    RAISE EXCEPTION 'invalid_group_title' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.funcionarios f WHERE f.id=p_actor_id AND f.ativo=true
  ) THEN
    RAISE EXCEPTION 'inactive_or_missing_actor' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_member_count
  FROM public.funcionarios f
  WHERE f.id = ANY(v_members) AND f.ativo=true;
  IF v_member_count <> cardinality(v_members) THEN
    RAISE EXCEPTION 'inactive_or_missing_member' USING ERRCODE='22023';
  END IF;

  -- Serialize direct-conversation creation for this canonical participant pair.
  IF p_tipo='directa' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(array_to_string(v_members, ':'), 0));
    SELECT c.id INTO v_existing_id
    FROM public.collab_conversations c
    JOIN public.collab_conversation_members m ON m.conversation_id=c.id
    WHERE c.tipo='directa' AND m.funcionario_id=ANY(v_members)
    GROUP BY c.id
    HAVING count(*)=2 AND count(*) FILTER (WHERE m.funcionario_id=ANY(v_members))=2
       AND array_agg(m.funcionario_id ORDER BY m.funcionario_id)=v_members
    LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('id',v_existing_id,'existing',true);
    END IF;
  END IF;

  INSERT INTO public.collab_conversations(tipo,titulo,criada_por,loja_id)
  SELECT p_tipo, CASE WHEN p_tipo='grupo' THEN trim(p_titulo) ELSE NULL END,
         p_actor_id, f.loja_id
  FROM public.funcionarios f WHERE f.id=p_actor_id
  RETURNING * INTO v_conversation;

  INSERT INTO public.collab_conversation_members(conversation_id,funcionario_id,papel)
  SELECT v_conversation.id, member_id,
         CASE WHEN member_id=p_actor_id THEN 'criador' ELSE 'membro' END
  FROM unnest(v_members) AS member_id;

  RETURN jsonb_build_object('id',v_conversation.id,'existing',false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_collab_conversation_with_members(uuid,text,text,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_collab_conversation_with_members(uuid,text,text,uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.send_collab_message_with_activity(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_body text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_message public.collab_messages%ROWTYPE;
BEGIN
  IF p_body IS NULL OR char_length(trim(p_body)) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'invalid_message_body' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    JOIN public.collab_conversation_members m ON m.funcionario_id=f.id
    WHERE f.id=p_sender_id AND f.ativo=true AND m.conversation_id=p_conversation_id
  ) THEN
    RAISE EXCEPTION 'sender_not_active_conversation_member' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.collab_conversations
  WHERE id=p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_not_found' USING ERRCODE='P0002'; END IF;

  INSERT INTO public.collab_messages(conversation_id,sender_id,body)
  VALUES (p_conversation_id,p_sender_id,trim(p_body))
  RETURNING * INTO v_message;

  UPDATE public.collab_conversations
  SET last_message_at=v_message.created_at, updated_at=v_message.created_at
  WHERE id=p_conversation_id;

  RETURN to_jsonb(v_message);
END;
$$;
REVOKE ALL ON FUNCTION public.send_collab_message_with_activity(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_collab_message_with_activity(uuid,uuid,text) TO service_role;
