ALTER TABLE public.crm_expansion_sites
  ADD COLUMN IF NOT EXISTS estimated_monthly_other_costs numeric(14,2) NOT NULL DEFAULT 0
    CHECK (estimated_monthly_other_costs >= 0),
  ADD COLUMN IF NOT EXISTS estimated_initial_stock numeric(14,2) NOT NULL DEFAULT 0
    CHECK (estimated_initial_stock >= 0);
COMMENT ON COLUMN public.crm_expansion_sites.estimated_monthly_other_costs IS 'Other recurring monthly operating costs, excluding rent.';
COMMENT ON COLUMN public.crm_expansion_sites.estimated_initial_stock IS 'Initial stock/capital allocated to the new store, separate from setup costs.';
