ALTER TABLE public.crm_expansion_sites
  ADD COLUMN IF NOT EXISTS estimated_monthly_staff_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_monthly_staff_cost >= 0),
  ADD COLUMN IF NOT EXISTS estimated_monthly_utilities_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_monthly_utilities_cost >= 0);
COMMENT ON COLUMN public.crm_expansion_sites.estimated_monthly_staff_cost IS 'Estimated monthly personnel cost for the proposed store.';
COMMENT ON COLUMN public.crm_expansion_sites.estimated_monthly_utilities_cost IS 'Estimated monthly utilities and energy cost for the proposed store.';
