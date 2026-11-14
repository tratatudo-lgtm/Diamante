-- Diamante D'Ouro | Hardening of trigger functions
-- Source-only migration: review before applying to the connected database.
-- Restricts direct RPC execution of the legacy trigger function and fixes
-- the mutable search_path warning on both trigger functions.

-- This legacy SECURITY DEFINER trigger function is not attached to any
-- trigger. No API role, including service_role, has a legitimate reason to
-- invoke it directly. Revoke the default PUBLIC grant and all API-role grants;
-- the owning role retains control of the function.
REVOKE EXECUTE
ON FUNCTION public.fn_atualizar_saldo_caixa()
FROM PUBLIC, anon, authenticated, service_role;

-- The function body schema-qualifies its table references, so keep the
-- SECURITY DEFINER search path limited to trusted system/temp schemas.
ALTER FUNCTION public.fn_atualizar_saldo_caixa()
SET search_path = pg_catalog, pg_temp;

-- The KPI function is attached to a transaction trigger and runs as invoker.
-- Its unqualified public-table references require public in the pinned path;
-- putting pg_temp last prevents temporary objects from shadowing those tables.
ALTER FUNCTION public.update_kpi_on_transaction()
SET search_path = pg_catalog, public, pg_temp;
