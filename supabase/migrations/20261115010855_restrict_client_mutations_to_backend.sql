-- Client data mutations are restricted to the authenticated backend API.
-- The API validates NIF, identity document, international phone and minimum age.
-- Authenticated users retain SELECT under the existing per-store RLS policies.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.clientes FROM anon, authenticated;
