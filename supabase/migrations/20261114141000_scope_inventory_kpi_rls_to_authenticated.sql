-- These tables are intended for signed-in staff only.
-- The API grants already exclude anon; scope policies explicitly to authenticated.
ALTER POLICY "Admins veem tudo"
  ON public.inventario_fisico TO authenticated;

ALTER POLICY "Funcionarios veem apenas sua loja"
  ON public.inventario_fisico TO authenticated;

ALTER POLICY "Admins veem tudo"
  ON public.kpi_loja_diaria TO authenticated;

ALTER POLICY "Funcionarios veem apenas KPI da sua loja"
  ON public.kpi_loja_diaria TO authenticated;
