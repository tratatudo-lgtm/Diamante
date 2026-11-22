#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?PGHOST obrigatório}"
: "${PGDATABASE:?PGDATABASE obrigatório}"
: "${PGUSER:?PGUSER obrigatório}"

psql -v ON_ERROR_STOP=1 -c 'DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
psql -v ON_ERROR_STOP=1 -c 'CREATE TABLE public.funcionarios (id uuid PRIMARY KEY);'

# Reproduzir a estrutura que já existe no Supabase antes de executar a migração.
psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  sender_number text NOT NULL,
  message_type text NOT NULL,
  content text,
  "timestamp" timestamptz DEFAULT now(),
  processed boolean DEFAULT false
);
INSERT INTO public.whatsapp_messages (instance_name, sender_number, message_type, content)
VALUES ('legacy-instance', '351900000099', 'text', 'Mensagem histórica de teste');
SQL

psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122100000_create_whatsapp_admin_conversations.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122120000_add_whatsapp_ai_send_claim.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122130000_allow_unresolved_whatsapp_lid_phone.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122140000_create_whatsapp_admin_audit.sql

# A migração deve preservar o registo antigo e disponibilizar body para o novo painel.
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_body text;
  v_instance text;
BEGIN
  SELECT body, instance_name INTO v_body, v_instance
  FROM public.whatsapp_messages
  WHERE sender_number = '351900000099';
  IF v_body <> 'Mensagem histórica de teste' THEN
    RAISE EXCEPTION 'conteúdo histórico não foi preservado';
  END IF;
  IF v_instance <> 'legacy-instance' THEN
    RAISE EXCEPTION 'colunas históricas não foram preservadas';
  END IF;
END $$;
SQL

# LID sem mapeamento telefónico deve poder ser guardado sem inventar um número.
psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_conversations (instance_name, remote_jid, contact_phone) VALUES ('ci-lid', 'opaque-lid@lid', NULL) RETURNING id;" >/dev/null

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

  SELECT status INTO v_mode FROM public.whatsapp_conversations WHERE id = v_conversation;
  IF v_mode <> 'unread' THEN RAISE EXCEPTION 'nova conversa deve iniciar como unread'; END IF;

  UPDATE public.whatsapp_conversations SET status = 'in_service' WHERE id = v_conversation;
  UPDATE public.whatsapp_conversations SET status = 'pending' WHERE id = v_conversation;
  UPDATE public.whatsapp_conversations SET status = 'resolved' WHERE id = v_conversation;
  SELECT status INTO v_mode FROM public.whatsapp_conversations WHERE id = v_conversation;
  IF v_mode <> 'resolved' THEN RAISE EXCEPTION 'estado resolvida não persistiu'; END IF;

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
  IF v_mode <> 'ai' THEN RAISE EXCEPTION 'retoma do Diamante não persistiu'; END IF;

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

# O token é texto porque os IDs dos eventos webhook são BIGINT e os tokens manuais são UUID.
psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_conversations (instance_name,remote_jid,contact_phone,ai_send_token) VALUES ('ci-token-type','351900000004@s.whatsapp.net','351900000004','123456789') RETURNING id;" >/dev/null

# Concorrência real: reserva do envio Diamante e takeover humano disputam a mesma linha.
psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.funcionarios (id) VALUES ('00000000-0000-4000-8000-000000000001');"
conversation_id="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_conversations (instance_name,remote_jid,contact_phone) VALUES ('ci-race','351900000002@s.whatsapp.net','351900000002') RETURNING id;")"
psql -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET ai_send_token='webhook-claim', ai_send_started_at=now() WHERE id='$conversation_id' AND mode='ai' AND ai_send_token IS NULL;"
claim_count="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET mode='human', assigned_admin_id='00000000-0000-4000-8000-000000000001' WHERE id='$conversation_id' AND mode='ai' AND ai_send_token IS NULL RETURNING id;" | wc -l | tr -d ' ')"
if [ "$claim_count" != "0" ]; then
  echo "takeover ultrapassou uma reserva ativa de envio" >&2
  exit 1
fi

# A auditoria é append-only: criar uma linha e tentar alterá-la tem de falhar.
psql -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_admin_audit (action, outcome) VALUES ('control_taken', 'success');"
if psql -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_admin_audit SET outcome='failed' WHERE action='control_taken';" >/dev/null 2>&1; then
  echo "esperava que update na auditoria fosse recusado" >&2
  exit 1
fi

# Segunda instalação limpa: a migração também tem de funcionar sem as colunas legadas.
fresh_db="${PGDATABASE}_whatsapp_fresh"
createdb "$fresh_db"
PGDATABASE="$fresh_db" psql -v ON_ERROR_STOP=1 -c 'CREATE TABLE public.funcionarios (id uuid PRIMARY KEY);'
PGDATABASE="$fresh_db" psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122100000_create_whatsapp_admin_conversations.sql
PGDATABASE="$fresh_db" psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122120000_add_whatsapp_ai_send_claim.sql
PGDATABASE="$fresh_db" psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122130000_allow_unresolved_whatsapp_lid_phone.sql
PGDATABASE="$fresh_db" psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122140000_create_whatsapp_admin_audit.sql
dropdb "$fresh_db"
