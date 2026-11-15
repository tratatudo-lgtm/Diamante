-- Auditable gold refining batches. This workflow is intentionally separate
-- from the legacy lotes_fundicao table whose complete schema is not defined
-- in the repository migrations.
CREATE TABLE IF NOT EXISTS public.ouro_fundicao_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_lote text NOT NULL UNIQUE DEFAULT (
    'FND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  estado text NOT NULL DEFAULT 'em_preparacao'
    CHECK (estado IN ('em_preparacao', 'concluido')),
  quantidade_pecas integer NOT NULL DEFAULT 0 CHECK (quantidade_pecas > 0),
  peso_entrada_gramas numeric(14,3) NOT NULL CHECK (peso_entrada_gramas > 0),
  peso_recuperado_gramas numeric(14,3),
  toque_milesimos numeric(7,3),
  ouro_fino_recuperado_gramas numeric(14,3),
  perda_processo_gramas numeric(14,3),
  rendimento_percentagem numeric(8,4),
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  concluido_por uuid,
  concluido_em timestamptz,
  observacoes text,
  CONSTRAINT ouro_fundicao_lotes_completion_check CHECK (
    (estado = 'em_preparacao'
      AND peso_recuperado_gramas IS NULL
      AND toque_milesimos IS NULL
      AND ouro_fino_recuperado_gramas IS NULL
      AND perda_processo_gramas IS NULL
      AND rendimento_percentagem IS NULL
      AND concluido_por IS NULL
      AND concluido_em IS NULL)
    OR
    (estado = 'concluido'
      AND peso_recuperado_gramas IS NOT NULL
      AND toque_milesimos IS NOT NULL
      AND ouro_fino_recuperado_gramas IS NOT NULL
      AND perda_processo_gramas IS NOT NULL
      AND rendimento_percentagem IS NOT NULL
      AND concluido_por IS NOT NULL
      AND concluido_em IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.ouro_fundicao_lote_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.ouro_fundicao_lotes(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL REFERENCES public.inventario_fisico(id) ON DELETE RESTRICT,
  transacao_origem_id uuid,
  codigo_peca text NOT NULL,
  peso_recebido_gramas numeric(14,3) NOT NULL CHECK (peso_recebido_gramas > 0),
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventario_id)
);

CREATE INDEX IF NOT EXISTS idx_ouro_fundicao_lotes_estado_data
  ON public.ouro_fundicao_lotes (estado, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ouro_fundicao_lote_pecas_lote
  ON public.ouro_fundicao_lote_pecas (lote_id);

ALTER TABLE public.ouro_fundicao_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ouro_fundicao_lote_pecas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ouro_fundicao_lotes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ouro_fundicao_lote_pecas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ouro_fundicao_lotes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ouro_fundicao_lote_pecas TO service_role;

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

  PERFORM id
  FROM public.inventario_fisico
  WHERE id = ANY(p_inventario_ids)
  FOR UPDATE;

  SELECT count(*), coalesce(sum(peso_recebido_gramas), 0)
  INTO v_count, v_weight
  FROM public.inventario_fisico
  WHERE id = ANY(p_inventario_ids)
    AND estado = 'recebido_sede'
    AND peso_recebido_gramas IS NOT NULL
    AND peso_recebido_gramas > 0;

  IF v_count <> cardinality(p_inventario_ids) OR v_weight <= 0 THEN
    RAISE EXCEPTION 'Todas as peças têm de estar recebidas e pesadas na sede.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.ouro_fundicao_lotes (
    quantidade_pecas, peso_entrada_gramas, criado_por, observacoes
  ) VALUES (
    v_count, v_weight, p_admin_id, nullif(left(btrim(coalesce(p_observacoes, '')), 1000), '')
  )
  RETURNING * INTO v_lote;

  INSERT INTO public.ouro_fundicao_lote_pecas (
    lote_id, inventario_id, transacao_origem_id, codigo_peca, peso_recebido_gramas
  )
  SELECT v_lote.id, id, transacao_origem_id, codigo_unico, peso_recebido_gramas
  FROM public.inventario_fisico
  WHERE id = ANY(p_inventario_ids)
    AND estado = 'recebido_sede';

  UPDATE public.inventario_fisico
  SET estado = 'em_lote_fundicao'
  WHERE id = ANY(p_inventario_ids)
    AND estado = 'recebido_sede';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível reservar as peças para o lote.' USING ERRCODE = '40001';
  END IF;

  RETURN v_lote;
END;
$function$;

CREATE OR REPLACE FUNCTION public.concluir_lote_ouro_fundicao(
  p_lote_id uuid,
  p_peso_recuperado_gramas numeric,
  p_toque_milesimos numeric,
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
  v_fine numeric(14,3);
  v_loss numeric(14,3);
  v_yield numeric(8,4);
BEGIN
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = p_admin_id AND ativo = true AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Administrador não autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lote
  FROM public.ouro_fundicao_lotes
  WHERE id = p_lote_id
  FOR UPDATE;

  IF NOT FOUND OR v_lote.estado <> 'em_preparacao' THEN
    RAISE EXCEPTION 'Lote inexistente ou já concluído.' USING ERRCODE = '23514';
  END IF;

  IF p_peso_recuperado_gramas IS NULL
     OR p_peso_recuperado_gramas <= 0
     OR p_peso_recuperado_gramas > v_lote.peso_entrada_gramas
     OR p_toque_milesimos IS NULL
     OR p_toque_milesimos < 0
     OR p_toque_milesimos > 1000 THEN
    RAISE EXCEPTION 'Peso recuperado ou toque inválido.' USING ERRCODE = '22023';
  END IF;

  v_fine := round(p_peso_recuperado_gramas * p_toque_milesimos / 1000, 3);
  v_loss := round(v_lote.peso_entrada_gramas - p_peso_recuperado_gramas, 3);
  v_yield := round(p_peso_recuperado_gramas / v_lote.peso_entrada_gramas * 100, 4);

  UPDATE public.ouro_fundicao_lotes
  SET estado = 'concluido',
      peso_recuperado_gramas = round(p_peso_recuperado_gramas, 3),
      toque_milesimos = round(p_toque_milesimos, 3),
      ouro_fino_recuperado_gramas = v_fine,
      perda_processo_gramas = v_loss,
      rendimento_percentagem = v_yield,
      concluido_por = p_admin_id,
      concluido_em = now(),
      observacoes = coalesce(nullif(left(btrim(coalesce(p_observacoes, '')), 1000), ''), observacoes)
  WHERE id = p_lote_id
  RETURNING * INTO v_lote;

  UPDATE public.inventario_fisico
  SET estado = 'fundido'
  WHERE id IN (
    SELECT inventario_id FROM public.ouro_fundicao_lote_pecas WHERE lote_id = p_lote_id
  )
    AND estado = 'em_lote_fundicao';

  RETURN v_lote;
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_lote_ouro_fundicao(uuid[], uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.concluir_lote_ouro_fundicao(uuid, numeric, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_lote_ouro_fundicao(uuid[], uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.concluir_lote_ouro_fundicao(uuid, numeric, numeric, uuid, text) TO service_role;
