-- Store expansion site studies and transparent scoring.
CREATE TABLE IF NOT EXISTS public.crm_expansion_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 180),
  address text NOT NULL CHECK (char_length(trim(address)) BETWEEN 5 AND 300),
  city text NOT NULL CHECK (char_length(trim(city)) BETWEEN 2 AND 120),
  district text CHECK (district IS NULL OR char_length(district) <= 120),
  latitude numeric(9,6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  area_sqm numeric(10,2) CHECK (area_sqm IS NULL OR area_sqm > 0),
  monthly_rent numeric(14,2) CHECK (monthly_rent IS NULL OR monthly_rent >= 0),
  estimated_setup_cost numeric(14,2) CHECK (estimated_setup_cost IS NULL OR estimated_setup_cost >= 0),
  estimated_monthly_revenue numeric(14,2) CHECK (estimated_monthly_revenue IS NULL OR estimated_monthly_revenue >= 0),
  footfall_score smallint NOT NULL DEFAULT 3 CHECK (footfall_score BETWEEN 1 AND 5),
  visibility_score smallint NOT NULL DEFAULT 3 CHECK (visibility_score BETWEEN 1 AND 5),
  accessibility_score smallint NOT NULL DEFAULT 3 CHECK (accessibility_score BETWEEN 1 AND 5),
  competition_score smallint NOT NULL DEFAULT 3 CHECK (competition_score BETWEEN 1 AND 5),
  security_score smallint NOT NULL DEFAULT 3 CHECK (security_score BETWEEN 1 AND 5),
  parking_score smallint NOT NULL DEFAULT 3 CHECK (parking_score BETWEEN 1 AND 5),
  fit_score smallint NOT NULL DEFAULT 3 CHECK (fit_score BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'em_avaliacao' CHECK (status IN ('em_avaliacao','visita_pendente','em_negociacao','aprovado','rejeitado','arquivado')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 8000),
  created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_expansion_sites_opportunity_unique UNIQUE(opportunity_id,name)
);
ALTER TABLE public.crm_expansion_sites
  ADD COLUMN IF NOT EXISTS weighted_score numeric(5,2)
  GENERATED ALWAYS AS (
    round(((footfall_score*25 + visibility_score*20 + accessibility_score*15 +
      competition_score*10 + security_score*10 + parking_score*5 + fit_score*15)::numeric / 5),2)
  ) STORED;
CREATE INDEX IF NOT EXISTS crm_expansion_sites_status_score_idx ON public.crm_expansion_sites(status,weighted_score DESC);
CREATE INDEX IF NOT EXISTS crm_expansion_sites_city_idx ON public.crm_expansion_sites(city);
CREATE INDEX IF NOT EXISTS crm_expansion_sites_opportunity_idx ON public.crm_expansion_sites(opportunity_id);
CREATE INDEX IF NOT EXISTS crm_expansion_sites_creator_idx ON public.crm_expansion_sites(created_by);

CREATE TABLE IF NOT EXISTS public.crm_expansion_site_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.crm_expansion_sites(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created','updated','status_changed')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_expansion_site_events_history_idx ON public.crm_expansion_site_events(site_id,created_at DESC);
CREATE INDEX IF NOT EXISTS crm_expansion_site_events_actor_idx ON public.crm_expansion_site_events(actor_id);
ALTER TABLE public.crm_expansion_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_expansion_site_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_expansion_sites,public.crm_expansion_site_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.crm_expansion_sites,public.crm_expansion_site_events TO service_role;
