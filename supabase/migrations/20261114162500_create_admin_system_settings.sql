-- Central system settings are managed exclusively by active administrators.
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configuracoes_sistema_chave_not_blank CHECK (length(btrim(chave)) > 0)
);

ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.configuracoes_sistema FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.configuracoes_sistema TO authenticated;

DROP POLICY IF EXISTS configuracoes_sistema_admin_select ON public.configuracoes_sistema;
CREATE POLICY configuracoes_sistema_admin_select
ON public.configuracoes_sistema
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS configuracoes_sistema_admin_insert ON public.configuracoes_sistema;
CREATE POLICY configuracoes_sistema_admin_insert
ON public.configuracoes_sistema
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS configuracoes_sistema_admin_update ON public.configuracoes_sistema;
CREATE POLICY configuracoes_sistema_admin_update
ON public.configuracoes_sistema
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMENT ON TABLE public.configuracoes_sistema IS
  'Configurações centrais em JSONB, acessíveis apenas a administradores ativos.';
