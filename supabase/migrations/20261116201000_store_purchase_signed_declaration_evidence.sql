-- Arquivo privado da declaração assinada em cada compra.
-- A evidência é carregada pelo backend antes da transação e ligada atomicamente
-- à transação pela RPC; clientes nunca recebem acesso direto ao bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'declaracoes-compras',
  'declaracoes-compras',
  false,
  6291456,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 6291456,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.store_purchase_consent_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key uuid NOT NULL UNIQUE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE RESTRICT,
  cliente_nome text NOT NULL CHECK (length(btrim(cliente_nome)) BETWEEN 1 AND 200),
  cliente_documento text NOT NULL CHECK (length(btrim(cliente_documento)) BETWEEN 1 AND 80),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 6291456),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  versao_declaracao text NOT NULL DEFAULT 'declaracao-compra-v1',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_purchase_consent_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.store_purchase_consent_evidence FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_purchase_consent_evidence TO service_role;

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS declaracao_assinada_id uuid
  REFERENCES public.store_purchase_consent_evidence(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transacoes_declaracao_assinada
  ON public.transacoes (declaracao_assinada_id)
  WHERE declaracao_assinada_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.create_store_purchase(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text, timestamptz);

-- Preserve the exact daily gold quote context used for every purchase.
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS cotacao_origem text,
  ADD COLUMN IF NOT EXISTS cotacao_moeda text,
  ADD COLUMN IF NOT EXISTS cotacao_unidade text,
  ADD COLUMN IF NOT EXISTS cotacao_observada_em timestamptz;

-- Require the extended, idempotent RPC; remove only its previous 14-argument signature.
DROP FUNCTION IF EXISTS public.create_store_purchase(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text);

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
  p_descricao text,
  p_cotacao_origem text,
  p_cotacao_moeda text,
  p_cotacao_unidade text,
  p_cotacao_observada_em timestamptz,
  p_declaracao_assinada_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_transaction public.transacoes%ROWTYPE;
  v_inventory_code text;
  v_consent_evidence public.store_purchase_consent_evidence%ROWTYPE;
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
    OR p_cotacao_origem IS NULL OR length(btrim(p_cotacao_origem)) = 0 OR length(p_cotacao_origem) > 100
    OR p_cotacao_moeda IS DISTINCT FROM 'EUR'
    OR p_cotacao_unidade IS DISTINCT FROM 'EUR/g_ouro_fino'
    OR p_cotacao_observada_em IS NULL
    OR p_declaracao_assinada_id IS NULL
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

  SELECT * INTO v_consent_evidence
  FROM public.store_purchase_consent_evidence
  WHERE id = p_declaracao_assinada_id
    AND idempotency_key = p_idempotency_key
    AND funcionario_id = p_funcionario_id
    AND loja_id = p_loja_id
    AND cliente_nome = btrim(p_cliente_nome)
    AND cliente_documento = btrim(p_cliente_cc)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Declaração assinada inválida ou não associada a esta compra'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transacoes (
    idempotency_key, declaracao_assinada_id, loja_id, funcionario_id, cliente_nome, cliente_cc, cliente_contacto,
    tipo_peca, metal, peso_gramas, valor_final, valor_sugerido,
    cotacao_spot_dia, cotacao_dia, margem_aplicada, descricao, estado,
    cotacao_origem, cotacao_moeda, cotacao_unidade, cotacao_observada_em
  ) VALUES (
    p_idempotency_key, p_declaracao_assinada_id, p_loja_id, p_funcionario_id, btrim(p_cliente_nome), btrim(p_cliente_cc),
    nullif(btrim(coalesce(p_cliente_contacto, '')), ''),
    btrim(p_tipo_peca), btrim(p_metal), p_peso_gramas, round(p_valor_final, 2),
    round(p_valor_sugerido, 2), p_cotacao_spot, p_cotacao_spot,
    p_margem, nullif(btrim(coalesce(p_descricao, '')), ''), 'pendente_aprovacao',
    btrim(p_cotacao_origem), p_cotacao_moeda, p_cotacao_unidade, p_cotacao_observada_em
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_transaction;

  IF NOT FOUND THEN
    SELECT * INTO v_transaction
    FROM public.transacoes
    WHERE idempotency_key = p_idempotency_key;

    IF NOT FOUND OR v_transaction.declaracao_assinada_id <> p_declaracao_assinada_id
      OR v_transaction.funcionario_id <> p_funcionario_id
      OR v_transaction.loja_id <> p_loja_id
      OR v_transaction.cliente_nome <> btrim(p_cliente_nome)
      OR v_transaction.cliente_cc IS DISTINCT FROM btrim(p_cliente_cc)
      OR v_transaction.cliente_contacto IS DISTINCT FROM nullif(btrim(coalesce(p_cliente_contacto, '')), '')
      OR v_transaction.tipo_peca <> btrim(p_tipo_peca)
      OR v_transaction.metal <> btrim(p_metal)
      OR v_transaction.peso_gramas <> p_peso_gramas
      OR v_transaction.valor_final <> round(p_valor_final, 2)
      OR v_transaction.descricao IS DISTINCT FROM nullif(btrim(coalesce(p_descricao, '')), '')
    THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada por outra operação'
        USING ERRCODE = '42501';
    END IF;

    RETURN to_jsonb(v_transaction) || jsonb_build_object('_idempotent_replay', true);
  END IF;

  v_inventory_code := 'INV-' || upper(replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO public.inventario_fisico (
    loja_atual_id, transacao_origem_id, codigo_unico,
    tipo_peca, metal, peso_gramas, estado
  ) VALUES (
    p_loja_id, v_transaction.id, v_inventory_code,
    btrim(p_tipo_peca), btrim(p_metal), p_peso_gramas, 'pendente_aprovacao'
  );

  RETURN to_jsonb(v_transaction) || jsonb_build_object('_idempotent_replay', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_store_purchase(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_purchase(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text, timestamptz, uuid) TO service_role;


COMMENT ON TABLE public.store_purchase_consent_evidence IS
  'Metadados de evidência documental da declaração assinada em cada compra. Ficheiros no bucket privado declaracoes-compras; acesso apenas via backend service_role.';
COMMENT ON COLUMN public.transacoes.declaracao_assinada_id IS
  'Referência à declaração assinada digitalizada e validada pelo backend para esta compra.';
