CREATE OR REPLACE FUNCTION public.fn_guard_despesa_fecho_mensal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_loja uuid; v_data date;
BEGIN
  IF TG_OP = 'DELETE' THEN v_loja := OLD.loja_id; v_data := OLD.data_despesa;
  ELSE v_loja := NEW.loja_id; v_data := NEW.data_despesa; END IF;
  IF EXISTS (SELECT 1 FROM public.fechos_financeiros_loja f
    WHERE f.loja_id=v_loja AND f.periodo=date_trunc('month',v_data)::date AND f.estado='fechado') THEN
    RAISE EXCEPTION 'O período financeiro desta loja está fechado.' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_fechar_mes_financeiro(p_loja_id uuid, p_periodo date, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v_row public.fechos_financeiros_loja%ROWTYPE;
  v_paid numeric(16,2); v_pending numeric(16,2); v_rejected numeric(16,2); v_count integer; v_categories jsonb;
BEGIN
  IF p_periodo IS NULL OR EXTRACT(DAY FROM p_periodo)<>1 THEN RAISE EXCEPTION 'Período inválido.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_loja_id::text||':'||p_periodo::text,0));
  SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true AND role='admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Apenas um administrador activo pode fechar o mês.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.lojas WHERE id=p_loja_id) THEN RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(sum(valor) FILTER(WHERE estado='paga'),0),
    COALESCE(sum(valor) FILTER(WHERE estado IN ('pendente','aprovada')),0),
    COALESCE(sum(valor) FILTER(WHERE estado='rejeitada'),0),count(*)::integer
  INTO v_paid,v_pending,v_rejected,v_count
  FROM public.despesas_operacionais
  WHERE loja_id=p_loja_id AND data_despesa>=p_periodo AND data_despesa<(p_periodo+interval '1 month');
  SELECT COALESCE(jsonb_object_agg(categoria,totals),'{}'::jsonb) INTO v_categories
  FROM (
    SELECT categoria,jsonb_build_object(
      'paga',COALESCE(sum(valor) FILTER(WHERE estado='paga'),0),
      'pendente',COALESCE(sum(valor) FILTER(WHERE estado IN ('pendente','aprovada')),0),
      'rejeitada',COALESCE(sum(valor) FILTER(WHERE estado='rejeitada'),0)
    ) AS totals
    FROM public.despesas_operacionais
    WHERE loja_id=p_loja_id AND data_despesa>=p_periodo AND data_despesa<(p_periodo+interval '1 month')
    GROUP BY categoria
  ) categories;
  INSERT INTO public.fechos_financeiros_loja
    (loja_id,periodo,estado,total_pago,total_pendente,total_rejeitado,quantidade_despesas,snapshot_categorias,fechado_por,fechado_em,reaberto_por,reaberto_em,motivo_reabertura)
  VALUES(p_loja_id,p_periodo,'fechado',v_paid,v_pending,v_rejected,v_count,v_categories,p_actor_id,now(),NULL,NULL,NULL)
  ON CONFLICT(loja_id,periodo) DO UPDATE SET estado='fechado',total_pago=EXCLUDED.total_pago,
    total_pendente=EXCLUDED.total_pendente,total_rejeitado=EXCLUDED.total_rejeitado,
    quantidade_despesas=EXCLUDED.quantidade_despesas,snapshot_categorias=EXCLUDED.snapshot_categorias,
    fechado_por=EXCLUDED.fechado_por,fechado_em=now(),reaberto_por=NULL,reaberto_em=NULL,
    motivo_reabertura=NULL,updated_at=now()
  WHERE public.fechos_financeiros_loja.estado='reaberto'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este mês já está fechado.' USING ERRCODE='23505'; END IF;
  INSERT INTO public.fechos_financeiros_eventos(fecho_id,loja_id,periodo,acao,actor_id,snapshot)
  VALUES(v_row.id,p_loja_id,p_periodo,'fechado',p_actor_id,to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_proteger_eventos_fecho()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de fechos é imutável.' USING ERRCODE='55000';
END;
$$;
DROP TRIGGER IF EXISTS trg_proteger_eventos_fecho ON public.fechos_financeiros_eventos;
CREATE TRIGGER trg_proteger_eventos_fecho BEFORE UPDATE OR DELETE ON public.fechos_financeiros_eventos
FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_eventos_fecho();
REVOKE ALL ON FUNCTION public.fn_proteger_eventos_fecho() FROM PUBLIC, anon, authenticated, service_role;
