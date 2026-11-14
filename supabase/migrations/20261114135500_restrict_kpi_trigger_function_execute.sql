-- The KPI function is an invoker-rights trigger function, not an RPC.
-- Its existing trigger continues to execute; API roles do not need direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.update_kpi_on_transaction()
  FROM PUBLIC, anon, authenticated;
