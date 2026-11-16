-- Extend the physical custody ledger through the hand-off into refining.
ALTER TABLE public.inventario_fisico
  ADD COLUMN IF NOT EXISTS fundicao_por uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT;

ALTER TABLE public.ouro_movimentos_fisicos
  ADD COLUMN IF NOT EXISTS lote_fundicao_id uuid REFERENCES public.ouro_fundicao_lotes(id) ON DELETE RESTRICT;

ALTER TABLE public.ouro_movimentos_fisicos
  DROP CONSTRAINT IF EXISTS ouro_movimentos_fisicos_evento_check;
ALTER TABLE public.ouro_movimentos_fisicos
  ADD CONSTRAINT ouro_movimentos_fisicos_evento_check
  CHECK (evento IN ('expedicao_sede','recepcao_sede','entrada_fundicao'));

CREATE INDEX IF NOT EXISTS idx_ouro_movimentos_lote_fundicao
  ON public.ouro_movimentos_fisicos(lote_fundicao_id, ocorrido_em)
  WHERE lote_fundicao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_ouro_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_event text;
  v_operator uuid;
  v_batch_id uuid;
BEGIN
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'enviado_sede' THEN
    v_event := 'expedicao_sede';
    v_operator := NEW.expedido_por;
  ELSIF NEW.estado = 'recebido_sede' THEN
    v_event := 'recepcao_sede';
    v_operator := NEW.recebido_por;
  ELSIF NEW.estado = 'em_lote_fundicao' THEN
    v_event := 'entrada_fundicao';
    v_operator := NEW.fundicao_por;
    SELECT lote_id INTO v_batch_id
    FROM public.ouro_fundicao_lote_pecas
    WHERE inventario_id = NEW.id
    ORDER BY adicionado_em DESC
    LIMIT 1;
    IF v_batch_id IS NULL THEN
      RAISE EXCEPTION 'Não existe lote de fundição associado à peça %.', NEW.id
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.ouro_movimentos_fisicos (
    inventario_id, evento, estado_anterior, estado_novo, loja_id,
    peso_declarado_gramas, peso_recebido_gramas, diferenca_peso_gramas,
    operador_id, ocorrido_em, observacoes, lote_fundicao_id
  ) VALUES (
    NEW.id, v_event, OLD.estado, NEW.estado, NEW.loja_atual_id,
    NEW.peso_gramas, NEW.peso_recebido_gramas, NEW.diferenca_peso_gramas,
    v_operator, now(),
    CASE WHEN v_event = 'recepcao_sede' THEN NEW.observacoes_rececao ELSE NULL END,
    v_batch_id
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_lote_ouro_fundicao(
  p_inventario_ids uuid[],
  p_admin_id uuid,
  p_observacoes text DEFAULT NULL
)
RETURNS public.ouro_fundicao_lotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_lote public.ouro_fundicao_lotes;
  v_count integer;
  v_weight numeric(14,3);
BEGIN
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = p_admin_id AND ativo = true AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Administrador não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF p_inventario_ids IS NULL
     OR cardinality(p_inventario_ids) < 1
     OR cardinality(p_inventario_ids) > 500
     OR cardinality(p_inventario_ids) <> (
       SELECT count(DISTINCT x) FROM unnest(p_inventario_ids) AS x
     ) THEN
    RAISE EXCEPTION 'Selecção de peças inválida.' USING ERRCODE = '22023';
  END IF;

  PERFORM id FROM public.inventario_fisico
  WHERE id = ANY(p_inventario_ids) FOR UPDATE;

  SELECT count(*), coalesce(sum(peso_recebido_gramas), 0)
  INTO v_count, v_weight
  FROM public.inventario_fisico
  WHERE id = ANY(p_inventario_ids)
    AND estado = 'recebido_sede'
    AND peso_recebido_gramas IS NOT NULL
    AND peso_recebido_gramas > 0
    AND metal ILIKE 'Ouro%';

  IF v_count <> cardinality(p_inventario_ids) OR v_weight <= 0 THEN
    RAISE EXCEPTION 'Todas as peças têm de estar recebidas e pesadas na sede.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.ouro_fundicao_lotes (
    quantidade_pecas, peso_entrada_gramas, criado_por, observacoes
  ) VALUES (
    v_count, v_weight, p_admin_id, nullif(left(btrim(coalesce(p_observacoes, '')), 1000), '')
  ) RETURNING * INTO v_lote;

  INSERT INTO public.ouro_fundicao_lote_pecas (
    lote_id, inventario_id, transacao_origem_id, codigo_peca, peso_recebido_gramas
  )
  SELECT v_lote.id, id, transacao_origem_id, codigo_unico, peso_recebido_gramas
  FROM public.inventario_fisico
  WHERE id = ANY(p_inventario_ids)
    AND estado = 'recebido_sede'
    AND metal ILIKE 'Ouro%';

  UPDATE public.inventario_fisico
  SET estado = 'em_lote_fundicao', fundicao_por = p_admin_id
  WHERE id = ANY(p_inventario_ids)
    AND estado = 'recebido_sede'
    AND metal ILIKE 'Ouro%';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível reservar as peças para o lote.' USING ERRCODE = '40001';
  END IF;
  RETURN v_lote;
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_lote_ouro_fundicao(uuid[], uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_lote_ouro_fundicao(uuid[], uuid, text) TO service_role;

