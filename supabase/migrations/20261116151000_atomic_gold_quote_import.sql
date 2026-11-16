-- Atomically activate a validated quote and append its immutable audit record.
CREATE OR REPLACE FUNCTION public.importar_cotacao_ouro(
  p_configuracao jsonb,
  p_fonte text,
  p_preco numeric,
  p_observada_em timestamptz,
  p_recebida_em timestamptz,
  p_margens_snapshot jsonb,
  p_estado_fonte jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_history_id uuid;
BEGIN
  IF p_configuracao IS NULL OR jsonb_typeof(p_configuracao) <> 'object'
    OR p_fonte IS DISTINCT FROM 'xaus.com'
    OR p_preco IS NULL OR p_preco <= 0
    OR p_observada_em IS NULL OR p_recebida_em IS NULL
    OR p_margens_snapshot IS NULL OR jsonb_typeof(p_margens_snapshot) <> 'array'
  THEN
    RAISE EXCEPTION 'Dados da cotação inválidos' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.configuracoes_sistema (chave, valor, updated_at)
  VALUES ('parametros_compra_ouro', p_configuracao, now())
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.cotacoes_ouro_historico (
    fonte, preco_referencia, moeda, unidade, observada_em, recebida_em,
    margens_snapshot, estado_fonte
  ) VALUES (
    p_fonte, p_preco, 'EUR', 'EUR/g_ouro_fino', p_observada_em, p_recebida_em,
    p_margens_snapshot, coalesce(p_estado_fonte, '{}'::jsonb)
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.importar_cotacao_ouro(jsonb, text, numeric, timestamptz, timestamptz, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.importar_cotacao_ouro(jsonb, text, numeric, timestamptz, timestamptz, jsonb, jsonb) TO service_role;
