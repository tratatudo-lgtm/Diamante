-- Replace stale JWT role/id checks with the active employee identity in the database.
-- Keep transaction visibility for the employee's own records and active store colleagues.
DROP POLICY IF EXISTS "Admins veem tudo" ON public.transacoes;
DROP POLICY IF EXISTS "Funcionarios veem apenas as suas transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Funcionarios veem apenas sua loja" ON public.transacoes;
DROP POLICY IF EXISTS "Apenas admins gerem estados criticos" ON public.transacoes;

CREATE POLICY "Admins ativos gerem transacoes"
  ON public.transacoes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Funcionarios ativos veem as suas transacoes"
  ON public.transacoes
  FOR SELECT
  TO authenticated
  USING (
    funcionario_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
    )
  );

CREATE POLICY "Funcionarios ativos veem transacoes da sua loja"
  ON public.transacoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.loja_id = transacoes.loja_id
    )
  );

-- Fundicao: administrators manage all lots; active employees can read only their store's lots.
DROP POLICY IF EXISTS "Admins gerem fundição" ON public.lotes_fundicao;
DROP POLICY IF EXISTS "Todos veem lotes" ON public.lotes_fundicao;

CREATE POLICY "Admins ativos gerem fundicao"
  ON public.lotes_fundicao
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Funcionarios ativos veem lotes da sua loja"
  ON public.lotes_fundicao
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funcionarios AS f
      WHERE f.id = (SELECT auth.uid())
        AND f.ativo = true
        AND f.loja_id = lotes_fundicao.loja_origem_id
    )
  );
