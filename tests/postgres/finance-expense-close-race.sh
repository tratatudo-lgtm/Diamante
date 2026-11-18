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
ADMIN="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
PERIOD="2027-01-01"
LOCK_KEY="${STORE}:${PERIOD}"

# Session A reserves the same advisory lock used by the expense trigger.
# Session B starts its INSERT while A owns the lock, so its statement snapshot
# predates the closing transaction. A closes the month and commits; B must
# observe the newly closed period after the lock is released.
psql -X -v ON_ERROR_STOP=1 -q <<SQL >"$TMP/closer.log" 2>&1 &
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('$LOCK_KEY', 0));
SELECT pg_sleep(3);
SELECT public.fn_fechar_mes_financeiro('$STORE','$PERIOD','$ADMIN');
COMMIT;
SQL
CLOSER_PID=$!

sleep 0.5
set +e
psql -X -v ON_ERROR_STOP=1 -q <<SQL >"$TMP/insert.log" 2>&1
INSERT INTO public.despesas_operacionais(
  id,loja_id,categoria,descricao,valor,data_despesa,estado,criado_por
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  '$STORE','material','Despesa concorrente após fecho',9.99,
  '2027-01-15','pendente','$ADMIN'
);
SQL
INSERT_RC=$?
wait "$CLOSER_PID"
CLOSE_RC=$?
set -e

if [[ "$CLOSE_RC" -ne 0 ]]; then
  echo "FAIL: fecho concorrente não concluiu"
  cat "$TMP/closer.log"
  exit 1
fi

if [[ "$INSERT_RC" -eq 0 ]]; then
  echo "FAIL: INSERT iniciado antes do fecho foi aceite depois do período fechar"
  cat "$TMP/insert.log"
  exit 1
fi

COUNT="$(psql -X -v ON_ERROR_STOP=1 -Atqc   "SELECT count(*) FROM public.despesas_operacionais WHERE id='40000000-0000-4000-8000-000000000001';")"
if [[ "$COUNT" != "0" ]]; then
  echo "FAIL: despesa concorrente persistiu apesar do período fechado"
  exit 1
fi

echo "POSTGRES_FINANCE_EXPENSE_CLOSE_RACE_OK"
