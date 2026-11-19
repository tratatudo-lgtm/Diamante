CREATE TABLE IF NOT EXISTS public.fechos_financeiros_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE RESTRICT,
  periodo date NOT NULL CHECK (EXTRACT(DAY FROM periodo) = 1),
  estado text NOT NULL DEFAULT 'fechado' CHECK (estado IN ('fechado','reaberto')),
  total_pago numeric(16,2) NOT NULL DEFAULT 0,
  total_pendente numeric(16,2) NOT NULL DEFAULT 0,
  total_rejeitado numeric(16,2) NOT NULL DEFAULT 0,
  quantidade_despesas integer NOT NULL DEFAULT 0,
  snapshot_categorias jsonb NOT NULL DEFAULT '{}'::jsonb,
  fechado_por uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  fechado_em timestamptz NOT NULL DEFAULT now(),
  reaberto_por uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  reaberto_em timestamptz,
  motivo_reabertura text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fechos_financeiros_loja_periodo_key UNIQUE (loja_id, periodo)
);
CREATE TABLE IF NOT EXISTS public.fechos_financeiros_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecho_id uuid NOT NULL REFERENCES public.fechos_financeiros_loja(id) ON DELETE RESTRICT,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE RESTRICT,
  periodo date NOT NULL,
  acao text NOT NULL CHECK (acao IN ('fechado','reaberto')),
  actor_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  motivo text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fechos_financeiros_periodo_idx ON public.fechos_financeiros_loja(periodo DESC, estado);
CREATE INDEX IF NOT EXISTS fechos_financeiros_eventos_fecho_idx ON public.fechos_financeiros_eventos(fecho_id, created_at DESC);
ALTER TABLE public.fechos_financeiros_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechos_financeiros_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fechos_financeiros_loja, public.fechos_financeiros_eventos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fechos_financeiros_loja, public.fechos_financeiros_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.fn_guard_despesa_fecho_mensal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_loja uuid; v_data date;
BEGIN
  v_loja := COALESCE(NEW.loja_id, OLD.loja_id);
  v_data := COALESCE(NEW.data_despesa, OLD.data_despesa);
  IF EXISTS (
    SELECT 1 FROM public.fechos_financeiros_loja f
    WHERE f.loja_id = v_loja AND f.periodo = date_trunc('month', v_data)::date AND f.estado = 'fechado'
  ) THEN
    RAISE EXCEPTION 'O período financeiro desta loja está fechado.' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_despesa_fecho_mensal ON public.despesas_operacionais;
CREATE TRIGGER trg_guard_despesa_fecho_mensal
BEFORE INSERT OR UPDATE OR DELETE ON public.despesas_operacionais
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_despesa_fecho_mensal();

CREATE OR REPLACE FUNCTION public.fn_fechar_mes_financeiro(p_loja_id uuid, p_periodo date, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v_row public.fechos_financeiros_loja%ROWTYPE;
  v_paid numeric(16,2); v_pending numeric(16,2); v_rejected numeric(16,2); v_count integer; v_categories jsonb;
BEGIN
  IF p_periodo IS NULL OR EXTRACT(DAY FROM p_periodo) <> 1 THEN RAISE EXCEPTION 'Período inválido.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_loja_id::text || ':' || p_periodo::text, 0));
  SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true AND role='admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Apenas um administrador activo pode fechar o mês.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE id=p_loja_id) THEN RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(sum(valor) FILTER (WHERE estado='paga'),0),
         COALESCE(sum(valor) FILTER (WHERE estado IN ('pendente','aprovada')),0),
         COALESCE(sum(valor) FILTER (WHERE estado='rejeitada'),0),
         count(*)::integer,
         COALESCE(jsonb_object_agg(categoria, total_categoria), '{}'::jsonb)
  INTO v_paid,v_pending,v_rejected,v_count,v_categories
  FROM (
    SELECT categoria, sum(valor)::numeric(16,2) AS total_categoria,
           max(estado) AS estado, sum(valor) AS valor
    FROM public.despesas_operacionais
    WHERE loja_id=p_loja_id AND data_despesa >= p_periodo AND data_despesa < (p_periodo + interval '1 month')
    GROUP BY categoria
  ) s;
  INSERT INTO public.fechos_financeiros_loja
    (loja_id,periodo,estado,total_pago,total_pendente,total_rejeitado,quantidade_despesas,snapshot_categorias,fechado_por,fechado_em,reaberto_por,reaberto_em,motivo_reabertura)
  VALUES (p_loja_id,p_periodo,'fechado',v_paid,v_pending,v_rejected,v_count,v_categories,p_actor_id,now(),NULL,NULL,NULL)
  ON CONFLICT (loja_id,periodo) DO UPDATE SET
    estado='fechado',total_pago=EXCLUDED.total_pago,total_pendente=EXCLUDED.total_pendente,
    total_rejeitado=EXCLUDED.total_rejeitado,quantidade_despesas=EXCLUDED.quantidade_despesas,
    snapshot_categorias=EXCLUDED.snapshot_categorias,fechado_por=EXCLUDED.fechado_por,
    fechado_em=now(),reaberto_por=NULL,reaberto_em=NULL,motivo_reabertura=NULL,updated_at=now()
  WHERE public.fechos_financeiros_loja.estado='reaberto'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este mês já está fechado.' USING ERRCODE='23505'; END IF;
  INSERT INTO public.fechos_financeiros_eventos(fecho_id,loja_id,periodo,acao,actor_id,snapshot)
  VALUES(v_row.id,p_loja_id,p_periodo,'fechado',p_actor_id,to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reabrir_mes_financeiro(p_fecho_id uuid, p_actor_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_actor public.funcionarios%ROWTYPE; v_row public.fechos_financeiros_loja%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.funcionarios WHERE id=p_actor_id AND ativo=true AND role='admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Apenas um administrador activo pode reabrir o mês.' USING ERRCODE='42501'; END IF;
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'O motivo da reabertura é obrigatório.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.fechos_financeiros_loja WHERE id=p_fecho_id FOR UPDATE;
  IF NOT FOUND OR v_row.estado <> 'fechado' THEN RAISE EXCEPTION 'Fecho não encontrado ou já reaberto.' USING ERRCODE='55000'; END IF;
  UPDATE public.fechos_financeiros_loja SET estado='reaberto',reaberto_por=p_actor_id,reaberto_em=now(),
    motivo_reabertura=trim(p_motivo),updated_at=now() WHERE id=p_fecho_id RETURNING * INTO v_row;
  INSERT INTO public.fechos_financeiros_eventos(fecho_id,loja_id,periodo,acao,actor_id,motivo,snapshot)
  VALUES(v_row.id,v_row.loja_id,v_row.periodo,'reaberto',p_actor_id,trim(p_motivo),to_jsonb(v_row));
  RETURN to_jsonb(v_row);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_guard_despesa_fecho_mensal() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_fechar_mes_financeiro(uuid,date,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_reabrir_mes_financeiro(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fechar_mes_financeiro(uuid,date,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_reabrir_mes_financeiro(uuid,uuid,text) TO service_role;
