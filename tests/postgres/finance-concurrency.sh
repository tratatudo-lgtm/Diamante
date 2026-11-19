#!/usr/bin/env bash
set -euo pipefail
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STORE="11111111-1111-4111-8111-111111111111"
ADMIN_A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ADMIN_B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
PERIOD="2026-12-01"

close_month() {
  local actor="$1" output="$2"
  psql -X -v ON_ERROR_STOP=1 -Atqc     "SELECT public.fn_fechar_mes_financeiro('$STORE','$PERIOD','$actor');" >"$output" 2>&1
}

set +e
close_month "$ADMIN_A" "$TMP/close-a" &
PID_A=$!
close_month "$ADMIN_B" "$TMP/close-b" &
PID_B=$!
wait "$PID_A"; RC_A=$?
wait "$PID_B"; RC_B=$?
set -e

if [[ "$RC_A" -eq 0 && "$RC_B" -eq 0 ]] || [[ "$RC_A" -ne 0 && "$RC_B" -ne 0 ]]; then
  echo "FAIL: concorrência de fecho: esperava exactamente um sucesso; A=$RC_A B=$RC_B"
  cat "$TMP/close-a" "$TMP/close-b"
  exit 1
fi

FECHO_ID="$(psql -X -v ON_ERROR_STOP=1 -Atqc   "SELECT id FROM public.fechos_financeiros_loja WHERE loja_id='$STORE' AND periodo='$PERIOD' AND estado='fechado';")"
if [[ -z "$FECHO_ID" ]]; then echo "FAIL: fecho concorrente não foi persistido"; exit 1; fi

reopen_month() {
  local actor="$1" reason="$2" output="$3"
  psql -X -v ON_ERROR_STOP=1 -Atqc     "SELECT public.fn_reabrir_mes_financeiro('$FECHO_ID','$actor','$reason');" >"$output" 2>&1
}

set +e
reopen_month "$ADMIN_A" "Reabertura concorrente A" "$TMP/reopen-a" &
PID_A=$!
reopen_month "$ADMIN_B" "Reabertura concorrente B" "$TMP/reopen-b" &
PID_B=$!
wait "$PID_A"; RC_A=$?
wait "$PID_B"; RC_B=$?
set -e

if [[ "$RC_A" -eq 0 && "$RC_B" -eq 0 ]] || [[ "$RC_A" -ne 0 && "$RC_B" -ne 0 ]]; then
  echo "FAIL: concorrência de reabertura: esperava exactamente um sucesso; A=$RC_A B=$RC_B"
  cat "$TMP/reopen-a" "$TMP/reopen-b"
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 -Atqc "
DO \$\$
BEGIN
  IF (SELECT estado FROM public.fechos_financeiros_loja WHERE id='$FECHO_ID') <> 'reaberto' THEN
    RAISE EXCEPTION 'Estado final da reabertura incorrecto';
  END IF;
  IF (SELECT count(*) FROM public.fechos_financeiros_eventos WHERE fecho_id='$FECHO_ID' AND acao='reaberto') <> 1 THEN
    RAISE EXCEPTION 'A concorrência criou mais de um evento de reabertura';
  END IF;
END
\$\$;"

echo "POSTGRES_FINANCE_CONCURRENCY_OK"
