#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?PGHOST obrigatório}"
: "${PGDATABASE:?PGDATABASE obrigatório}"
: "${PGUSER:?PGUSER obrigatório}"

psql -v ON_ERROR_STOP=1 -c 'DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
psql -v ON_ERROR_STOP=1 -c 'CREATE TABLE public.funcionarios (id uuid PRIMARY KEY);'\npsql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122100000_create_whatsapp_admin_conversations.sql

# Confirma os estados individuais de controlo IA/humano e as permissões mínimas.
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_conversation uuid;
  v_mode text;
  v_rls boolean;
BEGIN
  INSERT INTO public.whatsapp_conversations (instance_name, remote_jid, contact_phone, mode)
  VALUES ('ci', '351900000001@s.whatsapp.net', '351900000001', 'ai')
  RETURNING id INTO v_conversation;

  UPDATE public.whatsapp_conversations SET mode = 'human'
  WHERE id = v_conversation AND mode = 'ai';
  SELECT mode INTO v_mode FROM public.whatsapp_conversations WHERE id = v_conversation;
  IF v_mode <> 'human' THEN RAISE EXCEPTION 'human takeover não persistiu'; END IF;

  INSERT INTO public.whatsapp_messages (conversation_id, external_message_id, direction, sender_type, body)
  VALUES (v_conversation, 'inbound-ci-1', 'inbound', 'customer', 'Bom dia');

  INSERT INTO public.whatsapp_messages (conversation_id, direction, sender_type, body, status)
  VALUES (v_conversation, 'outbound', 'admin', 'Bom dia, em que posso ajudar?', 'sent');

  UPDATE public.whatsapp_conversations SET mode = 'ai', assigned_admin_id = null
  WHERE id = v_conversation AND mode = 'human';
  SELECT mode INTO v_mode FROM public.whatsapp_conversations WHERE id = v_conversation;
  IF v_mode <> 'ai' THEN RAISE EXCEPTION 'retoma do Groq não persistiu'; END IF;

  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid = 'public.whatsapp_conversations'::regclass;
  IF NOT v_rls THEN RAISE EXCEPTION 'RLS não está ativo'; END IF;

  IF has_table_privilege('anon', 'public.whatsapp_conversations', 'SELECT') THEN
    RAISE EXCEPTION 'anon não deve consultar conversas';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.whatsapp_conversations', 'SELECT') THEN
    RAISE EXCEPTION 'service_role deve consultar conversas';
  END IF;
END $$;
SQL

echo "PASS: schema de conversas, histórico, controlo IA/humano e RLS."
