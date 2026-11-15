-- Ensure every new in-store gold purchase starts unavailable until its
-- originating transaction receives final administrative approval.
CREATE OR REPLACE FUNCTION public.create_store_purchase(
  p_funcionario_id uuid,
  p_loja_id uuid,
  p_cliente_nome text,
  p_cliente_cc text,
  p_cliente_contacto text,
  p_tipo_peca text,
  p_metal text,
  p_peso_gramas numeric,
  p_valor_final numeric,
  p_valor_sugerido numeric,
  p_cotacao_spot numeric,
  p_margem numeric,
  p_descricao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_transaction public.transacoes%ROWTYPE;
  v_inventory_code text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.funcionarios f
    JOIN public.lojas l ON l.id = f.loja_id
    WHERE f.id = p_funcionario_id
      AND f.loja_id = p_loja_id
      AND f.ativo = true
      AND f.role = 'funcionario'
      AND l.ativo = true
  ) THEN
    RAISE EXCEPTION 'Funcionário ou loja inativa ou sem autorização'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transacoes (
    loja_id, funcionario_id, cliente_nome, cliente_cc, cliente_contacto,
    tipo_peca, metal, peso_gramas, valor_final, valor_sugerido,
    cotacao_spot_dia, cotacao_dia, margem_aplicada, descricao, estado
  ) VALUES (
    p_loja_id, p_funcionario_id, p_cliente_nome, p_cliente_cc, p_cliente_contacto,
    p_tipo_peca, p_metal, p_peso_gramas, round(p_valor_final, 2),
    round(p_valor_sugerido, 2), p_cotacao_spot, p_cotacao_spot,
    p_margem, p_descricao, 'pendente_aprovacao'
  )
  RETURNING * INTO v_transaction;

  v_inventory_code := 'INV-' || upper(replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO public.inventario_fisico (
    loja_atual_id, transacao_origem_id, codigo_unico,
    tipo_peca, metal, peso_gramas, estado
  ) VALUES (
    p_loja_id, v_transaction.id, v_inventory_code,
    p_tipo_peca, p_metal, p_peso_gramas, 'pendente_aprovacao'
  );

  RETURN to_jsonb(v_transaction);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_store_purchase(
  uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_store_purchase(
  uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text
) TO service_role;
