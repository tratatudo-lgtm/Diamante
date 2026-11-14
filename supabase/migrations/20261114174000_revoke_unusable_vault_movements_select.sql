-- Remove an API grant from a table intentionally locked by RLS with no policies.
-- Access remains unavailable to authenticated clients; service-role backend access is unaffected.
REVOKE SELECT ON TABLE public.movimentacoes_cofre FROM authenticated;
