-- Replace mutable JWT identity/role claims with the active employee row.
-- Preserve existing business visibility: own approver record, admin audit/config,
-- store-scoped messages and balances, and own time-clock records.

-- Approvers: only active admins manage; active employee sees own approver record.
DROP POLICY IF EXISTS "Apenas admins gerem aprovadores" ON public.aprovadores;
CREATE POLICY "Apenas admins ativos gerem aprovadores"
  ON public.aprovadores FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ));

DROP POLICY IF EXISTS "Aprovadores veem o proprio registo" ON public.aprovadores;
CREATE POLICY "Funcionarios ativos veem o proprio registo de aprovador"
  ON public.aprovadores FOR SELECT TO authenticated
  USING (
    funcionario_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.funcionarios f
      WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
    )
  );

-- Audit logs: only active admins can read.
DROP POLICY IF EXISTS "Apenas admins veem logs" ON public.auditoria_logs;
CREATE POLICY "Apenas admins ativos veem logs"
  ON public.auditoria_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ));

-- Admin-only configuration writes use the live employee role, not JWT claims.
DROP POLICY IF EXISTS "Apenas admins editam" ON public.configuracao_margens;
CREATE POLICY "Apenas admins ativos editam margens"
  ON public.configuracao_margens FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ));

DROP POLICY IF EXISTS "Apenas admins gerem bancos" ON public.configuracoes_bancarias;
CREATE POLICY "Apenas admins ativos gerem bancos"
  ON public.configuracoes_bancarias FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ));

-- Internal messages: active employee may send as themselves from their own store,
-- and read messages addressed to/from their store. Active admins can read all.
DROP POLICY IF EXISTS "Enviar mensagens" ON public.mensagens_internas;
CREATE POLICY "Funcionarios ativos enviam mensagens da sua loja"
  ON public.mensagens_internas FOR INSERT TO authenticated
  WITH CHECK (
    remetente_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.funcionarios f
      WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
        AND f.loja_id = mensagens_internas.loja_origem_id
    )
  );

DROP POLICY IF EXISTS "Ver mensagens da minha loja" ON public.mensagens_internas;
CREATE POLICY "Funcionarios ativos veem mensagens das suas lojas"
  ON public.mensagens_internas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funcionarios f
      WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
        AND (
          f.role IN ('admin', 'super_admin')
          OR f.loja_id = mensagens_internas.loja_origem_id
          OR f.loja_id = mensagens_internas.loja_destino_id
        )
    )
  );

-- Time clock: active employee sees own records; active admins see all.
DROP POLICY IF EXISTS "Funcionarios veem seu ponto" ON public.registos_ponto;
CREATE POLICY "Funcionarios ativos veem ponto proprio e admins veem todos"
  ON public.registos_ponto FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funcionarios f
      WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
        AND (
          f.role IN ('admin', 'super_admin')
          OR registos_ponto.funcionario_id = f.id
        )
    )
  );

-- Store balances: active employees see their own store; active admins see all.
DROP POLICY IF EXISTS "Admins e Funcionarios veem saldos da sua loja" ON public.saldos_lojas;
CREATE POLICY "Funcionarios ativos veem saldos da sua loja"
  ON public.saldos_lojas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND (
        f.role IN ('admin', 'super_admin')
        OR f.loja_id = saldos_lojas.loja_id
      )
  ));

-- Templates and purchase ceilings retain authenticated read access, but writes
-- are restricted to active administrators.
DROP POLICY IF EXISTS "Admins gerem templates" ON public.templates_loja;
CREATE POLICY "Admins ativos gerem templates"
  ON public.templates_loja FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ));

DROP POLICY IF EXISTS "Apenas admins editam" ON public.tetos_compra;
CREATE POLICY "Apenas admins ativos editam tetos"
  ON public.tetos_compra FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = (SELECT auth.uid()) AND f.ativo = true
      AND f.role IN ('admin', 'super_admin')
  ));
