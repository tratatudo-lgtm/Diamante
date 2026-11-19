CREATE OR REPLACE FUNCTION public.fn_guard_despesa_fecho_mensal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_loja uuid; v_data date;
BEGIN
  IF TG_OP='DELETE' THEN v_loja:=OLD.loja_id; v_data:=OLD.data_despesa;
  ELSE v_loja:=NEW.loja_id; v_data:=NEW.data_despesa; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_loja::text||':'||date_trunc('month',v_data)::date::text,0));
  IF EXISTS(SELECT 1 FROM public.fechos_financeiros_loja f
    WHERE f.loja_id=v_loja AND f.periodo=date_trunc('month',v_data)::date AND f.estado='fechado') THEN
    RAISE EXCEPTION 'O período financeiro desta loja está fechado.' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reabrir_mes_financeiro(p_fecho_id uuid,p_actor_id uuid,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v_row public.fechos_financeiros_loja%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true AND role='admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Apenas um administrador activo pode reabrir o mês.' USING ERRCODE='42501'; END IF;
  IF length(trim(COALESCE(p_motivo,'')))<5 THEN RAISE EXCEPTION 'O motivo da reabertura é obrigatório.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.fechos_financeiros_loja WHERE id=p_fecho_id FOR UPDATE;
  IF NOT FOUND OR v_row.estado<>'fechado' THEN RAISE EXCEPTION 'Fecho não encontrado ou já reaberto.' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.loja_id::text||':'||v_row.periodo::text,0));
  UPDATE public.fechos_financeiros_loja SET estado='reaberto',reaberto_por=p_actor_id,reaberto_em=now(),
    motivo_reabertura=trim(p_motivo),updated_at=now() WHERE id=p_fecho_id RETURNING * INTO v_row;
  INSERT INTO public.fechos_financeiros_eventos(fecho_id,loja_id,periodo,acao,actor_id,motivo,snapshot)
  VALUES(v_row.id,v_row.loja_id,v_row.periodo,'reaberto',p_actor_id,trim(p_motivo),to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END;
$$;
