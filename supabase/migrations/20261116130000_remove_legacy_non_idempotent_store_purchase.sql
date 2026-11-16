-- Remove the legacy non-idempotent purchase RPC reintroduced by
-- 20261115200000_start_new_gold_inventory_as_pending.sql.
-- The application calls the 14-argument RPC whose first argument is
-- p_idempotency_key. Keep that function and its service_role-only grant intact.
DROP FUNCTION IF EXISTS public.create_store_purchase(
  uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text
);
