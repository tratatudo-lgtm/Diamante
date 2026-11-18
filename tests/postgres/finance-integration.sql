\set ON_ERROR_STOP on

-- Legacy expense is created before audit triggers are installed.
INSERT INTO public.despesas_operacionais(
  id,loja_id,categoria,descricao,valor,data_despesa,estado,criado_por
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'renda','Despesa antiga',100.00,'2026-10-12','paga',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

\ir ../../supabase/migrations/20261115134500_store_operational_expenses.sql
\ir ../../supabase/migrations/20261115150000_monthly_store_financial_closing.sql
\ir ../../supabase/migrations/20261115151000_harden_monthly_financial_closing.sql
\ir ../../supabase/migrations/20261115152000_serialize_expense_mutations_with_monthly_closing.sql
\ir ../../supabase/migrations/20261118180000_harden_financial_period_integrity.sql
\ir ../../supabase/migrations/20261118220000_add_financial_payment_audit.sql
\ir ../../supabase/migrations/20261118230000_add_operational_expense_audit.sql
\ir ../../supabase/migrations/20261118240000_protect_financial_closing_snapshots.sql
\ir ../../supabase/migrations/20261118250000_fix_monthly_closing_mixed_expense_states.sql

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.transacoes_financeiras_eventos
  WHERE transacao_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    AND acao='legacy_import' AND actor_id IS NULL
    AND snapshot->>'transition_timestamp_not_available'='true';
  IF n <> 1 THEN RAISE EXCEPTION 'Pagamento legado não foi importado correctamente'; END IF;

  SELECT count(*) INTO n FROM public.despesas_operacionais_eventos
  WHERE despesa_id='10000000-0000-4000-8000-000000000001'
    AND acao='legacy_import' AND actor_id IS NULL
    AND snapshot->>'transition_timestamp_not_available'='true';
  IF n <> 1 THEN RAISE EXCEPTION 'Despesa legada não foi importada correctamente'; END IF;

  IF has_table_privilege('authenticated','public.transacoes_financeiras','UPDATE') THEN
    RAISE EXCEPTION 'authenticated ainda tem UPDATE directo em pagamentos';
  END IF;
END $$;

-- New expense, legal approval/payment transitions and audit trail.
INSERT INTO public.despesas_operacionais(
  id,loja_id,categoria,descricao,valor,data_despesa,estado,criado_por
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'energia_agua','Factura de energia',12.34,'2026-11-05','pendente',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
UPDATE public.despesas_operacionais
SET estado='aprovada',aprovado_por='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',approved_at=now(),updated_at=now()
WHERE id='20000000-0000-4000-8000-000000000001';
UPDATE public.despesas_operacionais
SET estado='paga',pago_por='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',paid_at=now(),updated_at=now()
WHERE id='20000000-0000-4000-8000-000000000001';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.despesas_operacionais_eventos
  WHERE despesa_id='20000000-0000-4000-8000-000000000001';
  IF n <> 3 THEN RAISE EXCEPTION 'Esperados 3 eventos de despesa, obtidos %',n; END IF;
END $$;

-- Rejection records actor, time and reason.
INSERT INTO public.despesas_operacionais(
  id,loja_id,categoria,descricao,valor,data_despesa,estado,criado_por
) VALUES (
  '20000000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'material','Material rejeitado',8.00,'2026-11-06','pendente',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
UPDATE public.despesas_operacionais
SET estado='rejeitada',rejeitado_por='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    rejected_at=now(),motivo_rejeicao='Documento inválido',updated_at=now()
WHERE id='20000000-0000-4000-8000-000000000002';

-- Same category with different states must be split into correct state totals.
INSERT INTO public.despesas_operacionais(
  id,loja_id,categoria,descricao,valor,data_despesa,estado,criado_por
) VALUES (
  '20000000-0000-4000-8000-000000000003',
  '11111111-1111-4111-8111-111111111111',
  'energia_agua','Ajuste energia rejeitado',3.33,'2026-11-07','pendente',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
UPDATE public.despesas_operacionais
SET estado='rejeitada',rejeitado_por='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    rejected_at=now(),motivo_rejeicao='Comprovativo insuficiente',updated_at=now()
WHERE id='20000000-0000-4000-8000-000000000003';

-- Payment audit and valid state transition.
INSERT INTO public.transacoes_financeiras(
  id,referencia,loja_id,loja_nome,beneficiario_nome,valor,metodo,descricao,estado,criado_por
) VALUES (
  '30000000-0000-4000-8000-000000000001','TEST-001',
  '11111111-1111-4111-8111-111111111111','Loja teste','Fornecedor',
  55.20,'transferencia','Pagamento teste','pendente',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
UPDATE public.transacoes_financeiras
SET estado='pago',pago_por='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',paid_at=now()
WHERE id='30000000-0000-4000-8000-000000000001';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.transacoes_financeiras_eventos
      WHERE transacao_id='30000000-0000-4000-8000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'Histórico do pagamento não contém criação e pagamento';
  END IF;
END $$;

-- Invalid transitions, data mutation, deletes and event tampering must fail.
DO $$
BEGIN
  BEGIN
    UPDATE public.despesas_operacionais SET valor=999
    WHERE id='20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Alteração de valor devia ser bloqueada';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;

  BEGIN
    DELETE FROM public.despesas_operacionais
    WHERE id='20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Eliminação de despesa devia ser bloqueada';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;

  BEGIN
    UPDATE public.despesas_operacionais_eventos SET motivo='adulterado'
    WHERE despesa_id='20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Alteração de evento devia ser bloqueada';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;

  BEGIN
    UPDATE public.transacoes_financeiras SET valor=1
    WHERE id='30000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Alteração de pagamento devia ser bloqueada';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;

  BEGIN
    DELETE FROM public.transacoes_financeiras_eventos
    WHERE transacao_id='30000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Eliminação de evento de pagamento devia ser bloqueada';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END $$;

-- Closing snapshot totals and immutable snapshot during reopening.
SELECT public.fn_fechar_mes_financeiro(
  '11111111-1111-4111-8111-111111111111','2026-11-01',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
DO $$
DECLARE f public.fechos_financeiros_loja%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.fechos_financeiros_loja
  WHERE loja_id='11111111-1111-4111-8111-111111111111' AND periodo='2026-11-01';
  IF f.total_pago <> 12.34 OR f.total_rejeitado <> 11.33 OR f.quantidade_despesas <> 3 THEN
    RAISE EXCEPTION 'Snapshot financeiro incorrecto: %, %, %, %',f.total_pago,f.total_rejeitado,f.total_pendente,f.quantidade_despesas;
  END IF;
  IF f.snapshot_categorias->'energia_agua'->>'paga' <> '12.34'
     OR f.snapshot_categorias->'energia_agua'->>'rejeitada' <> '3.33'
     OR f.snapshot_categorias->'energia_agua'->>'pendente' <> '0' THEN
    RAISE EXCEPTION 'Snapshot por categoria incorrecto: %',f.snapshot_categorias;
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.fechos_financeiros_loja SET total_pago=999
    WHERE loja_id='11111111-1111-4111-8111-111111111111' AND periodo='2026-11-01';
    RAISE EXCEPTION 'Snapshot fechado devia ser imutável';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END $$;

SELECT public.fn_reabrir_mes_financeiro(
  (SELECT id FROM public.fechos_financeiros_loja WHERE loja_id='11111111-1111-4111-8111-111111111111' AND periodo='2026-11-01'),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Correcção autorizada'
);
DO $$
DECLARE f public.fechos_financeiros_loja%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.fechos_financeiros_loja
  WHERE loja_id='11111111-1111-4111-8111-111111111111' AND periodo='2026-11-01';
  IF f.total_pago <> 12.34 OR f.total_rejeitado <> 11.33 OR f.estado <> 'reaberto' THEN
    RAISE EXCEPTION 'Reabertura alterou o snapshot original';
  END IF;
END $$;

-- Origin and destination periods are both protected on an UPDATE.
DO $$
BEGIN
  BEGIN
    UPDATE public.despesas_operacionais SET data_despesa='2026-10-20'
    WHERE id='20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Mudança para período de origem fechado devia falhar';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
END $$;

SELECT 'POSTGRES_FINANCE_INTEGRATION_OK' AS result;
