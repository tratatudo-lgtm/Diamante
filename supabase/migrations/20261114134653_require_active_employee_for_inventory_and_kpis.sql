-- Require an active employee record for inventory and KPI access.
-- Preserve the existing admin/super_admin and same-store visibility rules.

DROP POLICY IF EXISTS "Admins veem tudo" ON public.inventario_fisico;
CREATE POLICY "Admins veem tudo"
  ON public.inventario_fisico
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.role::text = ANY (ARRAY['admin', 'super_admin'])
    )
  );

DROP POLICY IF EXISTS "Funcionarios veem apenas sua loja" ON public.inventario_fisico;
CREATE POLICY "Funcionarios veem apenas sua loja"
  ON public.inventario_fisico
  FOR SELECT
  TO public
  USING (
    loja_atual_id = (
      SELECT f.loja_id
      FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
    )
  );

DROP POLICY IF EXISTS "Admins veem tudo" ON public.kpi_loja_diaria;
CREATE POLICY "Admins veem tudo"
  ON public.kpi_loja_diaria
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.role::text = ANY (ARRAY['admin', 'super_admin'])
    )
  );

DROP POLICY IF EXISTS "Funcionarios veem apenas KPI da sua loja" ON public.kpi_loja_diaria;
CREATE POLICY "Funcionarios veem apenas KPI da sua loja"
  ON public.kpi_loja_diaria
  FOR SELECT
  TO public
  USING (
    loja_id = (
      SELECT f.loja_id
      FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
    )
  );
