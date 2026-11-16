-- Auditable partial or full sale settlements for refined-gold batches.
-- Revenue is recorded only when an actual settlement is registered.
CREATE TABLE IF NOT EXISTS public.ouro_fundicao_liquidacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.ouro_fundicao_lotes(id) ON DELETE RESTRICT,
  chave_idempotencia uuid NOT NULL UNIQUE,
  ouro_fino_vendido_gramas numeric(14,3) NOT NULL CHECK (ouro_fino_vendido_gramas > 0),
  preco_por_grama numeric(14,6) NOT NULL CHECK (preco_por_grama > 0),
  receita_bruta numeric(14,2) NOT NULL CHECK (receita_bruta > 0),
  custo_lote_alocado numeric(14,2) NOT NULL CHECK (custo_lote_alocado >= 0),
  custos_adicionais numeric(14,2) NOT NULL DEFAULT 0 CHECK (custos_adicionais >= 0),
  resultado_liquido numeric(14,2) NOT NULL,
  comprador text NOT NULL CHECK (char_length(btrim(comprador)) BETWEEN 2 AND 200),
  referencia_documento text,
  liquidado_em timestamptz NOT NULL DEFAULT now(),
  registado_por uuid NOT NULL,
  CONSTRAINT ouro_fundicao_liquidacoes_document_check CHECK (
    referencia_documento IS NULL OR char_length(btrim(referencia_documento)) <= 200
  )
);

CREATE INDEX IF NOT EXISTS idx_ouro_fundicao_liquidacoes_lote_data
  ON public.ouro_fundicao_liquidacoes (lote_id, liquidado_em DESC);

ALTER TABLE public.ouro_fundicao_liquidacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ouro_fundicao_liquidacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ouro_fundicao_liquidacoes TO service_role;

CREATE OR REPLACE FUNCTION public.registar_liquidacao_ouro_fundicao(
  p_lote_id uuid,
  p_chave_idempotencia uuid,
  p_ouro_fino_vendido_gramas numeric,
  p_preco_por_grama numeric,
  p_custos_adicionais numeric,
  p_comprador text,
  p_referencia_documento text,
  p_admin_id uuid
)
RETURNS public.ouro_fundicao_liquidacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_batch public.ouro_fundicao_lotes;
  v_sale public.ouro_fundicao_liquidacoes;
  v_sold numeric(14,3);
  v_available numeric(14,3);
  v_total_cost numeric(14,2);
  v_allocated_cost numeric(14,2);
  v_revenue numeric(14,2);
  v_extra numeric(14,2);
BEGIN
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = p_admin_id AND ativo = true AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Administrador não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF p_chave_idempotencia IS NULL THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sale
  FROM public.ouro_fundicao_liquidacoes
  WHERE chave_idempotencia = p_chave_idempotencia;
  IF FOUND THEN
    RETURN v_sale;
  END IF;

  SELECT * INTO v_batch
  FROM public.ouro_fundicao_lotes
  WHERE id = p_lote_id
  FOR UPDATE;

  IF NOT FOUND OR v_batch.estado <> 'concluido' THEN
    RAISE EXCEPTION 'Só é possível liquidar lotes concluídos.' USING ERRCODE = '23514';
  END IF;

  IF p_ouro_fino_vendido_gramas IS NULL OR p_ouro_fino_vendido_gramas <= 0
     OR p_preco_por_grama IS NULL OR p_preco_por_grama <= 0
     OR p_custos_adicionais IS NULL OR p_custos_adicionais < 0
     OR p_comprador IS NULL OR char_length(btrim(p_comprador)) NOT BETWEEN 2 AND 200
     OR (p_referencia_documento IS NOT NULL AND char_length(btrim(p_referencia_documento)) > 200) THEN
    RAISE EXCEPTION 'Dados da liquidação inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(sum(ouro_fino_vendido_gramas), 0)
  INTO v_sold
  FROM public.ouro_fundicao_liquidacoes
  WHERE lote_id = p_lote_id;

  v_available := round(v_batch.ouro_fino_recuperado_gramas - v_sold, 3);
  IF p_ouro_fino_vendido_gramas > v_available THEN
    RAISE EXCEPTION 'Quantidade superior ao ouro fino ainda disponível (% g).', v_available USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(sum(valor), 0)::numeric(14,2)
  INTO v_extra
  FROM public.ouro_fundicao_custos
  WHERE lote_id = p_lote_id;

  v_total_cost := round(coalesce(v_batch.custo_aquisicao_total, 0) + v_extra, 2);
  v_allocated_cost := CASE
    WHEN v_batch.ouro_fino_recuperado_gramas > 0
    THEN round(v_total_cost * p_ouro_fino_vendido_gramas / v_batch.ouro_fino_recuperado_gramas, 2)
    ELSE 0
  END;
  v_revenue := round(p_ouro_fino_vendido_gramas * p_preco_por_grama, 2);
  v_extra := round(p_custos_adicionais, 2);

  INSERT INTO public.ouro_fundicao_liquidacoes (
    lote_id, chave_idempotencia, ouro_fino_vendido_gramas, preco_por_grama,
    receita_bruta, custo_lote_alocado, custos_adicionais, resultado_liquido,
    comprador, referencia_documento, registado_por
  ) VALUES (
    p_lote_id, p_chave_idempotencia, round(p_ouro_fino_vendido_gramas, 3),
    round(p_preco_por_grama, 6), v_revenue, v_allocated_cost, v_extra,
    round(v_revenue - v_allocated_cost - v_extra, 2),
    btrim(p_comprador), nullif(btrim(coalesce(p_referencia_documento, '')), ''), p_admin_id
  )
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$function$;

REVOKE ALL ON FUNCTION public.registar_liquidacao_ouro_fundicao(uuid, uuid, numeric, numeric, numeric, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registar_liquidacao_ouro_fundicao(uuid, uuid, numeric, numeric, numeric, text, text, uuid)
  TO service_role;

COMMENT ON TABLE public.ouro_fundicao_liquidacoes IS
  'Registo auditável de vendas parciais/totais de ouro fino recuperado; receita e resultado são valores realizados.';
