-- Diamante D'Ouro | Hardening of trigger functions
-- Source-only migration: review before applying to the connected database.
-- Restricts direct RPC execution of the legacy trigger function and fixes
-- the mutable search_path warning on both trigger functions.

-- This legacy trigger function is currently not attached to a user trigger.
-- Keep the function for compatibility, but prevent direct execution through
-- PostgREST by untrusted API roles. The owning role retains full control.
REVOKE ALL PRIVILEGES
ON FUNCTION public.fn_atualizar_saldo_caixa()
FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.fn_atualizar_saldo_caixa()
SET search_path = pg_catalog, public, pg_temp;

-- The KPI function is attached to a transaction trigger and runs as invoker.
-- Pin the search path so unqualified table references cannot be shadowed.
ALTER FUNCTION public.update_kpi_on_transaction()
SET search_path = pg_catalog, public, pg_temp;
