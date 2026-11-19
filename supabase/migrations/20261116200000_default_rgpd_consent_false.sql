-- Privacy by default: do not infer a customer's RGPD consent from a database default.
-- Existing rows are intentionally left unchanged; their legal basis and evidence
-- must be reviewed separately before any data migration is considered.
ALTER TABLE public.clientes
  ALTER COLUMN consentimento_rgpd SET DEFAULT false;

COMMENT ON COLUMN public.clientes.consentimento_rgpd IS
  'Indicates a recorded privacy consent where consent is the applicable legal basis. New records default to false; this value must not be treated as evidence of consent without an auditable record.';
