#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST obrigatório}"
: "${PGDATABASE:?PGDATABASE obrigatório}"
: "${PGUSER:?PGUSER obrigatório}"

psql -v ON_ERROR_STOP=1 -c 'DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261120100000_create_diamante_intelligence_dedup.sql

suffix="ci-$(date +%s%N)"
message_id="duplicate-${suffix}"
retry_id="retry-${suffix}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Duas sessões PostgreSQL tentam inserir a mesma chave ao mesmo tempo.
insert_sql="INSERT INTO public.diamante_intelligence_webhook_events (instance_name,message_id,status) VALUES ('ci-concurrency','${message_id}','processing');"
(psql -X -q -v ON_ERROR_STOP=1 -c "$insert_sql" >"$tmp/insert-a.out" 2>"$tmp/insert-a.err"; echo $? >"$tmp/insert-a.rc") &
pid_a=$!
(psql -X -q -v ON_ERROR_STOP=1 -c "$insert_sql" >"$tmp/insert-b.out" 2>"$tmp/insert-b.err"; echo $? >"$tmp/insert-b.rc") &
pid_b=$!
wait "$pid_a" || true
wait "$pid_b" || true
rc_a="$(cat "$tmp/insert-a.rc")"
rc_b="$(cat "$tmp/insert-b.rc")"
if ! { [[ "$rc_a" == 0 && "$rc_b" != 0 ]] || [[ "$rc_b" == 0 && "$rc_a" != 0 ]]; }; then
  echo "Esperava exatamente um INSERT vencedor; rc_a=$rc_a rc_b=$rc_b"
  cat "$tmp/insert-a.err" "$tmp/insert-b.err"
  exit 1
fi
insert_count="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.diamante_intelligence_webhook_events WHERE instance_name='ci-concurrency' AND message_id='${message_id}';")"
[[ "$insert_count" == 1 ]] || { echo "Deduplicação incorreta: count=$insert_count"; exit 1; }

# Duas sessões tentam reclamar a mesma falha Groq: só uma pode mudar failed -> processing.
psql -X -q -v ON_ERROR_STOP=1 -c "INSERT INTO public.diamante_intelligence_webhook_events (instance_name,message_id,status,error_code,retry_count) VALUES ('ci-concurrency','${retry_id}','failed','GROQ_RATE_LIMITED',0);"
claim_sql="UPDATE public.diamante_intelligence_webhook_events SET status='processing',error_code=NULL,retry_count=1 WHERE instance_name='ci-concurrency' AND message_id='${retry_id}' AND status='failed' AND retry_count=0 AND error_code LIKE 'GROQ_%' RETURNING id;"
(psql -X -qAt -v ON_ERROR_STOP=1 -c "$claim_sql" >"$tmp/claim-a.out") &
pid_a=$!
(psql -X -qAt -v ON_ERROR_STOP=1 -c "$claim_sql" >"$tmp/claim-b.out") &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
claim_count="$(cat "$tmp/claim-a.out" "$tmp/claim-b.out" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
[[ "$claim_count" == 1 ]] || { echo "Esperava uma única reclamação atómica; count=$claim_count"; exit 1; }

# Verifica que os estados de entrega incerta são aceites e não colapsam em failed.
psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE public.diamante_intelligence_webhook_events SET status='sending' WHERE instance_name='ci-concurrency' AND message_id='${message_id}'; UPDATE public.diamante_intelligence_webhook_events SET status='unknown' WHERE instance_name='ci-concurrency' AND message_id='${message_id}' AND status='sending';"
final_status="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT status FROM public.diamante_intelligence_webhook_events WHERE instance_name='ci-concurrency' AND message_id='${message_id}';")"
[[ "$final_status" == "unknown" ]] || { echo "Estado final inesperado: $final_status"; exit 1; }

echo "PASS: insert duplicado concorrente, retry claim atómico e estado unknown."
