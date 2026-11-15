-- Make store purchase retries idempotent and validate invariants inside the database.
DROP FUNCTION IF EXISTS public.create_store_purchase(
  uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text
);

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_idempotency_key_uidx
  ON public.transacoes (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Enforce at most one physical inventory item per originating purchase.
CREATE UNIQUE INDEX IF NOT EXISTS inventario_fisico_transacao_origem_uidx
  ON public.inventario_fisico (transacao_origem_id)
  WHERE transacao_origem_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_store_purchase(
  p_idempotency_key uuid,
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
  IF p_idempotency_key IS NULL
    OR p_funcionario_id IS NULL
    OR p_loja_id IS NULL
    OR p_cliente_nome IS NULL OR length(btrim(p_cliente_nome)) = 0 OR length(p_cliente_nome) > 200
    OR p_cliente_cc IS NULL OR length(btrim(p_cliente_cc)) = 0 OR length(p_cliente_cc) > 80
    OR length(coalesce(p_cliente_contacto, '')) > 40
    OR p_tipo_peca IS NULL OR length(btrim(p_tipo_peca)) = 0 OR length(p_tipo_peca) > 100
    OR p_metal IS NULL OR length(btrim(p_metal)) = 0 OR length(p_metal) > 100
    OR p_descricao IS NOT NULL AND length(p_descricao) > 2000
    OR p_peso_gramas IS NULL OR p_peso_gramas <= 0 OR p_peso_gramas > 100000
    OR p_valor_final IS NULL OR p_valor_final <= 0 OR p_valor_final > 100000000
    OR p_valor_sugerido IS NULL OR p_valor_sugerido < 0
    OR p_cotacao_spot IS NULL OR p_cotacao_spot < 0
    OR p_margem IS NULL OR p_margem < 0 OR p_margem > 100
  THEN
    RAISE EXCEPTION 'Dados da compra inválidos'
      USING ERRCODE = '22023';
  END IF;

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
    idempotency_key, loja_id, funcionario_id, cliente_nome, cliente_cc, cliente_contacto,
    tipo_peca, metal, peso_gramas, valor_final, valor_sugerido,
    cotacao_spot_dia, cotacao_dia, margem_aplicada, descricao, estado
  ) VALUES (
    p_idempotency_key, p_loja_id, p_funcionario_id, btrim(p_cliente_nome), btrim(p_cliente_cc),
    nullif(btrim(coalesce(p_cliente_contacto, '')), ''),
    btrim(p_tipo_peca), btrim(p_metal), p_peso_gramas, round(p_valor_final, 2),
    round(p_valor_sugerido, 2), p_cotacao_spot, p_cotacao_spot,
    p_margem, nullif(btrim(coalesce(p_descricao, '')), ''), 'pendente_aprovacao'
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_transaction;

  IF NOT FOUND THEN
    SELECT * INTO v_transaction
    FROM public.transacoes
    WHERE idempotency_key = p_idempotency_key;

    IF NOT FOUND OR v_transaction.funcionario_id <> p_funcionario_id
      OR v_transaction.loja_id <> p_loja_id
      OR v_transaction.cliente_nome <> btrim(p_cliente_nome)
      OR v_transaction.cliente_cc IS DISTINCT FROM btrim(p_cliente_cc)
      OR v_transaction.cliente_contacto IS DISTINCT FROM nullif(btrim(coalesce(p_cliente_contacto, '')), '')
      OR v_transaction.tipo_peca <> btrim(p_tipo_peca)
      OR v_transaction.metal <> btrim(p_metal)
      OR v_transaction.peso_gramas <> p_peso_gramas
      OR v_transaction.valor_final <> round(p_valor_final, 2)
      OR v_transaction.valor_sugerido <> round(p_valor_sugerido, 2)
      OR v_transaction.cotacao_spot_dia IS DISTINCT FROM p_cotacao_spot
      OR v_transaction.margem_aplicada IS DISTINCT FROM p_margem
      OR v_transaction.descricao IS DISTINCT FROM nullif(btrim(coalesce(p_descricao, '')), '')
    THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada por outra operação'
        USING ERRCODE = '42501';
    END IF;

    RETURN to_jsonb(v_transaction);
  END IF;

  v_inventory_code := 'INV-' || upper(replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO public.inventario_fisico (
    loja_atual_id, transacao_origem_id, codigo_unico,
    tipo_peca, metal, peso_gramas, estado
  ) VALUES (
    p_loja_id, v_transaction.id, v_inventory_code,
    btrim(p_tipo_peca), btrim(p_metal), p_peso_gramas, 'pendente_aprovacao'
  );

  RETURN to_jsonb(v_transaction);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_store_purchase(
  uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_store_purchase(
  uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text
) TO service_role;
