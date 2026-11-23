#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  telemovel text NOT NULL
);
INSERT INTO public.clientes (id,nome,telemovel)
VALUES
 ('00000000-0000-4000-8000-000000000101','Cliente OTP A','351910000101'),
 ('00000000-0000-4000-8000-000000000102','Cliente OTP B','351910000102');
SQL

psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261123100000_create_whatsapp_client_otp.sql

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_phone_hash text := repeat('a',64);
  v_code_hash text := repeat('b',64);
  v_status text;
  v_client_id uuid;
  i integer;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.whatsapp_client_otp_challenges'::regclass) THEN
    RAISE EXCEPTION 'RLS não está ativo na tabela OTP de clientes';
  END IF;
  IF has_table_privilege('anon','public.whatsapp_client_otp_challenges','SELECT')
     OR has_table_privilege('authenticated','public.whatsapp_client_otp_challenges','SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated não podem consultar desafios OTP';
  END IF;
  IF NOT has_function_privilege('service_role',
    'public.create_whatsapp_client_otp_challenge(text,uuid,text,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role precisa de executar RPC de criação';
  END IF;
  IF has_function_privilege('authenticated',
    'public.consume_whatsapp_client_otp_challenge(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated não pode executar RPC de consumo';
  END IF;

  SELECT status INTO v_status FROM public.create_whatsapp_client_otp_challenge(
    v_phone_hash,'00000000-0000-4000-8000-000000000101',v_code_hash,now()+interval '5 minutes');
  IF v_status <> 'created' THEN RAISE EXCEPTION 'primeiro desafio não criado: %',v_status; END IF;

  SELECT status INTO v_status FROM public.create_whatsapp_client_otp_challenge(
    v_phone_hash,'00000000-0000-4000-8000-000000000101',repeat('c',64),now()+interval '5 minutes');
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'não deve substituir desafio ativo: %',v_status; END IF;

  SELECT status,client_id INTO v_status,v_client_id
  FROM public.consume_whatsapp_client_otp_challenge(v_phone_hash,v_code_hash);
  IF v_status <> 'valid' OR v_client_id <> '00000000-0000-4000-8000-000000000101'::uuid THEN
    RAISE EXCEPTION 'OTP válido não devolveu o cliente esperado';
  END IF;
  SELECT status INTO v_status FROM public.consume_whatsapp_client_otp_challenge(v_phone_hash,v_code_hash);
  IF v_status <> 'not_found' THEN RAISE EXCEPTION 'OTP reutilizado foi aceite'; END IF;

  -- Cinco pedidos numa janela: o sexto é bloqueado.
  FOR i IN 1..4 LOOP
    SELECT status INTO v_status FROM public.create_whatsapp_client_otp_challenge(
      v_phone_hash,'00000000-0000-4000-8000-000000000101',repeat('d',63)||i::text,now()+interval '5 minutes');
    IF v_status <> 'created' THEN RAISE EXCEPTION 'pedido % devia ser permitido, recebeu %',i+1,v_status; END IF;
    UPDATE public.whatsapp_client_otp_challenges SET consumed_at=now() WHERE phone_hash=v_phone_hash;
  END LOOP;
  SELECT status INTO v_status FROM public.create_whatsapp_client_otp_challenge(
    v_phone_hash,'00000000-0000-4000-8000-000000000101',repeat('e',64),now()+interval '5 minutes');
  IF v_status <> 'rate_limited' THEN RAISE EXCEPTION 'sexto pedido devia ser bloqueado: %',v_status; END IF;

  -- Três códigos incorretos bloqueiam o desafio.
  v_phone_hash := repeat('f',64);
  v_code_hash := repeat('1',64);
  SELECT status INTO v_status FROM public.create_whatsapp_client_otp_challenge(
    v_phone_hash,'00000000-0000-4000-8000-000000000102',v_code_hash,now()+interval '5 minutes');
  IF v_status <> 'created' THEN RAISE EXCEPTION 'desafio para teste de tentativas não criado'; END IF;
  FOR i IN 1..3 LOOP
    SELECT status INTO v_status FROM public.consume_whatsapp_client_otp_challenge(v_phone_hash,repeat('2',64));
  END LOOP;
  IF v_status <> 'locked' THEN RAISE EXCEPTION 'terceira tentativa incorreta não bloqueou'; END IF;
END $$;
SQL

echo "WhatsApp client OTP: migração, RLS, permissões, consumo único e limites validados."
