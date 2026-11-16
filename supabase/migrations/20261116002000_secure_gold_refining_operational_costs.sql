CREATE OR REPLACE FUNCTION public.adicionar_custo_ouro_fundicao(
  p_lote_id uuid,
  p_categoria text,
  p_descricao text,
  p_valor numeric,
  p_admin_id uuid
)
RETURNS public.ouro_fundicao_custos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_batch public.ouro_fundicao_lotes;
  v_cost public.ouro_fundicao_custos;
BEGIN
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = p_admin_id AND ativo = true AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Administrador não autorizado.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_batch FROM public.ouro_fundicao_lotes
  WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND OR v_batch.estado <> 'em_preparacao' THEN
    RAISE EXCEPTION 'Só é possível adicionar custos a lotes em preparação.' USING ERRCODE = '23514';
  END IF;
  IF p_categoria NOT IN ('transporte','analise','fundicao','outro')
     OR p_descricao IS NULL OR char_length(btrim(p_descricao)) NOT BETWEEN 2 AND 300
     OR p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Dados do custo inválidos.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ouro_fundicao_custos(lote_id,categoria,descricao,valor,registado_por)
  VALUES(p_lote_id,p_categoria,btrim(p_descricao),round(p_valor,2),p_admin_id)
  RETURNING * INTO v_cost;
  RETURN v_cost;
END;
$function$;
REVOKE ALL ON FUNCTION public.adicionar_custo_ouro_fundicao(uuid,text,text,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adicionar_custo_ouro_fundicao(uuid,text,text,numeric,uuid) TO service_role;
