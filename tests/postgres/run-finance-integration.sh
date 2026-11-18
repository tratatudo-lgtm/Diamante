#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
psql -v ON_ERROR_STOP=1 -f "$ROOT/tests/postgres/fixture.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/tests/postgres/finance-integration.sql"
bash "$ROOT/tests/postgres/finance-concurrency.sh"
bash "$ROOT/tests/postgres/finance-expense-close-race.sh"
