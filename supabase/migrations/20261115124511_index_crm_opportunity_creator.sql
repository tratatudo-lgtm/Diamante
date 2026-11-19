CREATE INDEX IF NOT EXISTS crm_opportunities_created_by_idx
  ON public.crm_opportunities(created_by, created_at DESC);
