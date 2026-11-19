\set ON_ERROR_STOP on
-- Isolated PostgreSQL regression test for purchase idempotency replay.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE TABLE public.lojas (
 id uuid PRIMARY KEY, nome text NOT NULL, ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE public.funcionarios (
 id uuid PRIMARY KEY, nome_completo text NOT NULL, role text NOT NULL,
 ativo boolean NOT NULL DEFAULT true, loja_id uuid REFERENCES public.lojas(id)
);
CREATE TABLE public.transacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key uuid, loja_id uuid NOT NULL REFERENCES public.lojas(id),
 funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id),
 cliente_nome text NOT NULL, cliente_cc text NOT NULL, cliente_contacto text,
 tipo_peca text NOT NULL, metal text NOT NULL, peso_gramas numeric NOT NULL,
 valor_final numeric NOT NULL, valor_sugerido numeric NOT NULL,
 cotacao_spot_dia numeric NOT NULL, cotacao_dia numeric NOT NULL,
 margem_aplicada numeric NOT NULL, descricao text, estado text NOT NULL,
 cotacao_origem text, cotacao_moeda text, cotacao_unidade text,
 cotacao_observada_em timestamptz,
 declaracao_assinada_id uuid
);
CREATE TABLE public.inventario_fisico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 loja_atual_id uuid NOT NULL REFERENCES public.lojas(id),
 transacao_origem_id uuid REFERENCES public.transacoes(id),
 codigo_unico text NOT NULL, tipo_peca text NOT NULL, metal text NOT NULL,
 peso_gramas numeric NOT NULL, estado text NOT NULL
);
INSERT INTO public.lojas(id,nome) VALUES
 ('11111111-1111-4111-8111-111111111111','Loja teste');
INSERT INTO public.funcionarios(id,nome_completo,role,loja_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Funcionário teste','funcionario','11111111-1111-4111-8111-111111111111');

CREATE TABLE public.store_purchase_consent_evidence (
 id uuid PRIMARY KEY, idempotency_key uuid NOT NULL UNIQUE,
 funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id),
 loja_id uuid NOT NULL REFERENCES public.lojas(id),
 cliente_nome text NOT NULL, cliente_documento text NOT NULL,
 storage_path text NOT NULL UNIQUE, mime_type text NOT NULL,
 tamanho_bytes bigint NOT NULL, sha256 text NOT NULL,
 versao_declaracao text NOT NULL DEFAULT 'declaracao-compra-v1',
 uploaded_at timestamptz NOT NULL DEFAULT now()
);

\ir ../../supabase/migrations/20261116140000_snapshot_daily_gold_quote_on_purchase.sql
\ir ../../supabase/migrations/20261119110000_remove_unbound_purchase_rpc_and_store_actor_role.sql
INSERT INTO public.store_purchase_consent_evidence (id,idempotency_key,funcionario_id,loja_id,cliente_nome,cliente_documento,storage_path,mime_type,tamanho_bytes,sha256) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Cliente teste','CC123','test/key/doc.pdf','application/pdf',100,repeat('a',64));

DO $test$
DECLARE
 v_key uuid := '22222222-2222-4222-8222-222222222222';
 v_result jsonb; v_count integer; v_failed boolean;
 v_func uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_store uuid := '11111111-1111-4111-8111-111111111111';
 v_stamp timestamptz := '2026-11-19T10:00:00Z';
 v_base jsonb := jsonb_build_object(
  'cliente_nome','Cliente teste','cliente_cc','CC123','cliente_contacto','912345678',
  'tipo_peca','Anel','metal','Ouro','peso_gramas',10,
  'valor_final',500,'valor_sugerido',600,'cotacao_spot',75,'margem',16.67,
  'descricao','Compra teste','cotacao_origem','fonte_teste','cotacao_moeda','EUR',
  'cotacao_unidade','EUR/g_ouro_fino','cotacao_observada_em','2026-11-19T10:00:00Z'
 );
 v_payload jsonb;
BEGIN
 v_payload:=v_base;
 v_result:=public.create_store_purchase(v_key,v_func,v_store,
  v_payload->>'cliente_nome',v_payload->>'cliente_cc',v_payload->>'cliente_contacto',
  v_payload->>'tipo_peca',v_payload->>'metal',(v_payload->>'peso_gramas')::numeric,
  (v_payload->>'valor_final')::numeric,(v_payload->>'valor_sugerido')::numeric,
  (v_payload->>'cotacao_spot')::numeric,(v_payload->>'margem')::numeric,
  v_payload->>'descricao',v_payload->>'cotacao_origem',v_payload->>'cotacao_moeda',
  v_payload->>'cotacao_unidade',(v_payload->>'cotacao_observada_em')::timestamptz,'33333333-3333-4333-8333-333333333333');
 IF coalesce((v_result->>'_idempotent_replay')::boolean,true) THEN
  RAISE EXCEPTION 'A primeira compra não foi marcada como criação original';
 END IF;

 -- An identical retry must return the original transaction and create no second item.
 v_result:=public.create_store_purchase(v_key,v_func,v_store,
  v_payload->>'cliente_nome',v_payload->>'cliente_cc',v_payload->>'cliente_contacto',
  v_payload->>'tipo_peca',v_payload->>'metal',(v_payload->>'peso_gramas')::numeric,
  (v_payload->>'valor_final')::numeric,(v_payload->>'valor_sugerido')::numeric,
  (v_payload->>'cotacao_spot')::numeric,(v_payload->>'margem')::numeric,
  v_payload->>'descricao',v_payload->>'cotacao_origem',v_payload->>'cotacao_moeda',
  v_payload->>'cotacao_unidade',(v_payload->>'cotacao_observada_em')::timestamptz);
 IF NOT coalesce((v_result->>'_idempotent_replay')::boolean,false) THEN
  RAISE EXCEPTION 'Replay idêntico não foi reconhecido';
 END IF;

 -- Change each quote-related field independently; every replay must be rejected.
 FOR v_payload IN
  SELECT v_base || jsonb_build_object(k,val)
  FROM (VALUES
   ('valor_sugerido','601'),('cotacao_spot','76'),('margem','17'),
   ('cotacao_origem','outra_fonte'),('cotacao_moeda','USD'),
   ('cotacao_unidade','USD/g'),('cotacao_observada_em','2026-11-19T10:01:00Z')
  ) AS changes(k,val)
 LOOP
  v_failed:=false;
  BEGIN
   PERFORM public.create_store_purchase(v_key,v_func,v_store,
    v_payload->>'cliente_nome',v_payload->>'cliente_cc',v_payload->>'cliente_contacto',
    v_payload->>'tipo_peca',v_payload->>'metal',(v_payload->>'peso_gramas')::numeric,
    (v_payload->>'valor_final')::numeric,(v_payload->>'valor_sugerido')::numeric,
    (v_payload->>'cotacao_spot')::numeric,(v_payload->>'margem')::numeric,
    v_payload->>'descricao',v_payload->>'cotacao_origem',v_payload->>'cotacao_moeda',
    v_payload->>'cotacao_unidade',(v_payload->>'cotacao_observada_em')::timestamptz);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_failed:=true;
  END;
  IF NOT v_failed THEN
   RAISE EXCEPTION 'Replay divergente não foi rejeitado: %',v_payload;
  END IF;
 END LOOP;

 SELECT count(*) INTO v_count FROM public.transacoes WHERE idempotency_key=v_key;
 IF v_count<>1 THEN RAISE EXCEPTION 'Número de transacções inesperado: %',v_count; END IF;
 SELECT count(*) INTO v_count FROM public.inventario_fisico
 WHERE transacao_origem_id=(v_result->>'id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'Número de itens de inventário inesperado: %',v_count; END IF;
END $test$;
SELECT 'POSTGRES_STORE_PURCHASE_IDEMPOTENCY_OK' AS result;
