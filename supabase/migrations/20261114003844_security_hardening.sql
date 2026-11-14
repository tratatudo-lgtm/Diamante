-- Diamante D'Ouro | Security hardening
-- Aplicada no Supabase em 2026-11-14.
-- Não altera dados existentes.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;

GRANT SELECT (id, nome, morada, telefone, codigo_loja, ativo, latitude, longitude)
ON TABLE public.lojas TO anon;

REVOKE TRUNCATE, TRIGGER, REFERENCES
ON ALL TABLES IN SCHEMA public
FROM authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.v_clientes_protegidos FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.v_clientes_protegidos
FROM authenticated;

ALTER VIEW public.v_clientes_protegidos
SET (security_invoker = true);

GRANT SELECT ON TABLE public.v_clientes_protegidos TO authenticated;

DROP POLICY IF EXISTS "Acesso total a clientes para staff"
ON public.clientes;

DROP POLICY IF EXISTS clientes_update_policy
ON public.clientes;

CREATE POLICY clientes_update_admin_or_own_store
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR loja_registo_id = get_auth_user_loja_id()
)
WITH CHECK (
  is_admin()
  OR loja_registo_id = get_auth_user_loja_id()
);

DROP POLICY IF EXISTS "Todos veem inventario"
ON public.inventario_fisico;

DROP POLICY IF EXISTS "Apenas admins/gerentes editam"
ON public.inventario_fisico;

DROP POLICY IF EXISTS "Registo de ponto"
ON public.registos_ponto;

DROP POLICY IF EXISTS "Funcionarios registam apenas na sua loja"
ON public.registos_ponto;

CREATE POLICY registos_ponto_insert_own_active_employee
ON public.registos_ponto
FOR INSERT
TO authenticated
WITH CHECK (
  funcionario_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE f.id = auth.uid()
      AND f.ativo = true
      AND f.loja_id = registos_ponto.loja_id
  )
);
