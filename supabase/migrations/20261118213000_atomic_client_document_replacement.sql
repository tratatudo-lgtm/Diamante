-- Atomically replace a client's active identity document and synchronize client metadata.
CREATE OR REPLACE FUNCTION public.replace_client_identity_document(
  p_client_id uuid,
  p_actor_id uuid,
  p_tipo_documento text,
  p_numero_documento text,
  p_data_emissao date,
  p_data_validade date,
  p_storage_path text,
  p_mime_type text,
  p_tamanho_bytes bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor public.funcionarios%ROWTYPE;
  v_client public.clientes%ROWTYPE;
  v_previous_id uuid;
  v_document public.cliente_documentos%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_client_id IS NULL
     OR p_tipo_documento NOT IN ('cc','passaporte','cartao_residente','outro')
     OR p_numero_documento IS NULL OR length(btrim(p_numero_documento)) NOT BETWEEN 1 AND 80
     OR p_data_validade IS NULL OR (p_data_emissao IS NOT NULL AND p_data_emissao > p_data_validade)
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp')
     OR p_tamanho_bytes IS NULL OR p_tamanho_bytes NOT BETWEEN 1 AND 6291456
     OR p_storage_path IS NULL OR p_storage_path NOT LIKE p_client_id::text || '/%'
     OR position('..' in p_storage_path) > 0 THEN
    RAISE EXCEPTION 'invalid_document' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_actor FROM public.funcionarios
  WHERE id=p_actor_id AND ativo=true FOR SHARE;
  IF NOT FOUND OR v_actor.role NOT IN ('admin','funcionario') THEN
    RAISE EXCEPTION 'inactive_or_unauthorized_actor' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_client FROM public.clientes
  WHERE id=p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'client_not_found' USING ERRCODE='P0002'; END IF;

  IF v_actor.role <> 'admin' AND v_actor.loja_id IS DISTINCT FROM v_client.loja_registo_id THEN
    RAISE EXCEPTION 'client_outside_actor_store' USING ERRCODE='42501';
  END IF;

  SELECT id INTO v_previous_id FROM public.cliente_documentos
  WHERE cliente_id=p_client_id AND substituido_em IS NULL
  FOR UPDATE;

  IF v_previous_id IS NOT NULL THEN
    UPDATE public.cliente_documentos
    SET substituido_em=now(), substituido_por=p_actor_id
    WHERE id=v_previous_id AND substituido_em IS NULL;
  END IF;

  INSERT INTO public.cliente_documentos(
    cliente_id,tipo_documento,numero_documento,data_emissao,data_validade,
    storage_path,mime_type,tamanho_bytes,uploaded_by
  ) VALUES (
    p_client_id,p_tipo_documento,btrim(p_numero_documento),p_data_emissao,p_data_validade,
    p_storage_path,p_mime_type,p_tamanho_bytes,p_actor_id
  ) RETURNING * INTO v_document;

  UPDATE public.clientes SET
    tipo_documento=p_tipo_documento,
    bi_cc=btrim(p_numero_documento),
    data_emissao_documento=p_data_emissao,
    data_validade_documento=p_data_validade
  WHERE id=p_client_id;

  RETURN jsonb_build_object('documento_id',v_document.id,'previous_documento_id',v_previous_id);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_client_identity_document(uuid,uuid,text,text,date,date,text,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_client_identity_document(uuid,uuid,text,text,date,date,text,text,bigint) TO service_role;
