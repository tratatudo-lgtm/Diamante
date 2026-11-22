#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?PGHOST obrigatório}"
: "${PGDATABASE:?PGDATABASE obrigatório}"
: "${PGUSER:?PGUSER obrigatório}"

psql -v ON_ERROR_STOP=1 -c 'DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
psql -v ON_ERROR_STOP=1 -c 'CREATE TABLE public.funcionarios (id uuid PRIMARY KEY);'
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122100000_create_whatsapp_admin_conversations.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122120000_add_whatsapp_ai_send_claim.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122130000_allow_unresolved_whatsapp_lid_phone.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261122140000_create_whatsapp_admin_audit.sql

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


# O token é texto porque os IDs dos eventos webhook são BIGINT e os tokens manuais são UUID.
psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_conversations (instance_name,remote_jid,contact_phone,ai_send_token) VALUES ('ci-token-type','351900000004@s.whatsapp.net','351900000004','123456789') RETURNING id;" >/dev/null

# Concorrência real: reserva do envio Diamante e takeover humano disputam a mesma linha.
psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.funcionarios (id) VALUES ('00000000-0000-4000-8000-000000000001');"
conversation_id="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_conversations (instance_name,remote_jid,contact_phone) VALUES ('ci-race','351900000002@s.whatsapp.net','351900000002') RETURNING id;")"
claim_token="$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'SELECT gen_random_uuid();')"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET ai_send_token='${claim_token}', ai_send_started_at=now() WHERE id='${conversation_id}' AND mode='ai' AND ai_send_token IS NULL RETURNING id;" >"$tmp/ai.out") &
pid_ai=$!
(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET mode='human', assigned_admin_id='00000000-0000-4000-8000-000000000001' WHERE id='${conversation_id}' AND mode='ai' AND ai_send_token IS NULL RETURNING id;" >"$tmp/human.out") &
pid_human=$!
wait "$pid_ai"
wait "$pid_human"
race_state="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT mode || ':' || (ai_send_token IS NOT NULL)::text FROM public.whatsapp_conversations WHERE id='${conversation_id}';")"
[[ "$race_state" == "ai:true" || "$race_state" == "human:false" ]] || { echo "Race inconsistente: $race_state"; exit 1; }

# Testa a mesma reserva para respostas manuais: devolver o controlo é bloqueado
# enquanto o envio manual estiver reservado.
manual_conversation_id="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.whatsapp_conversations (instance_name,remote_jid,contact_phone,mode,assigned_admin_id) VALUES ('ci-manual','351900000003@s.whatsapp.net','351900000003','human','00000000-0000-4000-8000-000000000001') RETURNING id;")"
manual_token="$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'SELECT gen_random_uuid();')"
manual_claim="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET ai_send_token='${manual_token}', ai_send_started_at=now() WHERE id='${manual_conversation_id}' AND mode='human' AND assigned_admin_id='00000000-0000-4000-8000-000000000001' AND ai_send_token IS NULL RETURNING id;")"
[[ -n "$manual_claim" ]] || { echo "Reserva manual não foi adquirida"; exit 1; }
takeover_release="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET mode='ai',assigned_admin_id=NULL,ai_send_token=NULL WHERE id='${manual_conversation_id}' AND mode='human' AND assigned_admin_id='00000000-0000-4000-8000-000000000001' AND ai_send_token IS NULL RETURNING id;")"
[[ -z "$takeover_release" ]] || { echo "Devolução ao Diamante ultrapassou envio manual reservado"; exit 1; }
psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET ai_send_token=NULL,ai_send_started_at=NULL WHERE id='${manual_conversation_id}' AND ai_send_token='${manual_token}';" >/dev/null
takeover_release="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE public.whatsapp_conversations SET mode='ai',assigned_admin_id=NULL WHERE id='${manual_conversation_id}' AND mode='human' AND assigned_admin_id='00000000-0000-4000-8000-000000000001' AND ai_send_token IS NULL RETURNING id;")"
[[ -n "$takeover_release" ]] || { echo "Devolução ao Diamante falhou após libertação da reserva"; exit 1; }

echo "PASS: schema, histórico, RLS, concorrência IA/humano e reserva de resposta manual."

# Auditoria append-only: takeover, devolução, estado e ciclo de mensagem manual.
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_conversation uuid;
  v_message uuid;
  v_count integer;
  v_audit uuid;
BEGIN
  INSERT INTO public.whatsapp_conversations (
    instance_name, remote_jid, contact_phone, mode, last_controlled_by
  ) VALUES (
    'ci-audit', '351900000005@s.whatsapp.net', '351900000005', 'ai',
    '00000000-0000-4000-8000-000000000001'
  ) RETURNING id INTO v_conversation;

  UPDATE public.whatsapp_conversations
    SET mode='human', assigned_admin_id='00000000-0000-4000-8000-000000000001',
        last_controlled_by='00000000-0000-4000-8000-000000000001'
    WHERE id=v_conversation;

  UPDATE public.whatsapp_conversations SET status='in_service' WHERE id=v_conversation;

  INSERT INTO public.whatsapp_messages (
    conversation_id, direction, sender_type, body, status, admin_id
  ) VALUES (
    v_conversation, 'outbound', 'admin', 'Resposta de teste', 'sending',
    '00000000-0000-4000-8000-000000000001'
  ) RETURNING id INTO v_message;

  UPDATE public.whatsapp_messages SET status='sent', sent_at=now() WHERE id=v_message;
  UPDATE public.whatsapp_conversations
    SET mode='ai', assigned_admin_id=null,
        last_controlled_by='00000000-0000-4000-8000-000000000001'
    WHERE id=v_conversation;

  SELECT count(*) INTO v_count
    FROM public.whatsapp_admin_audit
    WHERE conversation_id=v_conversation
      AND action IN ('control_taken','control_released','admin_message_created',
                     'admin_message_sent','conversation_status_changed');
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'esperados 5 eventos de auditoria, encontrados %', v_count;
  END IF;

  SELECT id INTO v_audit FROM public.whatsapp_admin_audit
    WHERE conversation_id=v_conversation LIMIT 1;
  BEGIN
    UPDATE public.whatsapp_admin_audit SET outcome='failed' WHERE id=v_audit;
    RAISE EXCEPTION 'auditoria permitiu UPDATE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'auditoria permitiu UPDATE' THEN RAISE; END IF;
  END;
END $$;
SQL
