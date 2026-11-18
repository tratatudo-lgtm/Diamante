-- Correct monthly closing totals: classify each expense by its own state,
-- not by MAX(estado) after grouping expenses by category.
CREATE OR REPLACE FUNCTION public.fn_fechar_mes_financeiro(
  p_loja_id uuid,
  p_periodo date,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor public.funcionarios%ROWTYPE;
  v_row public.fechos_financeiros_loja%ROWTYPE;
  v_paid numeric(16,2);
  v_pending numeric(16,2);
  v_rejected numeric(16,2);
  v_count integer;
  v_categories jsonb;
BEGIN
  IF p_loja_id IS NULL OR p_periodo IS NULL
     OR EXTRACT(DAY FROM p_periodo) <> 1 THEN
    RAISE EXCEPTION 'Loja ou período inválido.' USING ERRCODE = '22023';
  END IF;

  -- Same lock key/order used by expense mutations and reopening.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_loja_id::text || ':' || p_periodo::text, 0)
  );

  SELECT * INTO v_actor
  FROM public.funcionarios
  WHERE id = p_actor_id AND ativo = true AND role = 'admin';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apenas um administrador activo pode fechar o mês.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE id = p_loja_id) THEN
    RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE = '22023';
  END IF;

  -- Each expense contributes to exactly one state total.
  SELECT
    coalesce(sum(valor) FILTER (WHERE estado = 'paga'), 0)::numeric(16,2),
    coalesce(sum(valor) FILTER (WHERE estado IN ('pendente', 'aprovada')), 0)::numeric(16,2),
    coalesce(sum(valor) FILTER (WHERE estado = 'rejeitada'), 0)::numeric(16,2),
    count(*)::integer
  INTO v_paid, v_pending, v_rejected, v_count
  FROM public.despesas_operacionais
  WHERE loja_id = p_loja_id
    AND data_despesa >= p_periodo
    AND data_despesa < (p_periodo + interval '1 month');

  -- Category snapshot is independent of state totals.
  SELECT coalesce(
    jsonb_object_agg(category_totals.categoria, category_totals.total_categoria),
    '{}'::jsonb
  )
  INTO v_categories
  FROM (
    SELECT categoria, sum(valor)::numeric(16,2) AS total_categoria
    FROM public.despesas_operacionais
    WHERE loja_id = p_loja_id
      AND data_despesa >= p_periodo
      AND data_despesa < (p_periodo + interval '1 month')
    GROUP BY categoria
  ) AS category_totals;

  INSERT INTO public.fechos_financeiros_loja (
    loja_id, periodo, estado, total_pago, total_pendente, total_rejeitado,
    quantidade_despesas, snapshot_categorias, fechado_por, fechado_em,
    reaberto_por, reaberto_em, motivo_reabertura
  ) VALUES (
    p_loja_id, p_periodo, 'fechado', v_paid, v_pending, v_rejected,
    v_count, v_categories, p_actor_id, now(), NULL, NULL, NULL
  )
  ON CONFLICT (loja_id, periodo) DO UPDATE SET
    estado = 'fechado',
    total_pago = EXCLUDED.total_pago,
    total_pendente = EXCLUDED.total_pendente,
    total_rejeitado = EXCLUDED.total_rejeitado,
    quantidade_despesas = EXCLUDED.quantidade_despesas,
    snapshot_categorias = EXCLUDED.snapshot_categorias,
    fechado_por = EXCLUDED.fechado_por,
    fechado_em = now(),
    reaberto_por = NULL,
    reaberto_em = NULL,
    motivo_reabertura = NULL,
    updated_at = now()
  WHERE public.fechos_financeiros_loja.estado = 'reaberto'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este mês já está fechado.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.fechos_financeiros_eventos (
    fecho_id, loja_id, periodo, acao, actor_id, snapshot
  ) VALUES (
    v_row.id, p_loja_id, p_periodo, 'fechado', p_actor_id, to_jsonb(v_row)
  );

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_fechar_mes_financeiro(uuid, date, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fechar_mes_financeiro(uuid, date, uuid)
  TO service_role;

COMMENT ON FUNCTION public.fn_fechar_mes_financeiro(uuid, date, uuid) IS
  'Fecha o período sob advisory lock; calcula totais por estado ao nível de cada despesa e snapshot independente por categoria.';
