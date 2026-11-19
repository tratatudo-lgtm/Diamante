-- Keep closed monthly expense periods immutable, including both sides of UPDATE.
-- Serialize all mutations and closing/reopening with the same advisory-lock order.
CREATE OR REPLACE FUNCTION public.fn_guard_despesa_fecho_mensal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_keys text[];
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_keys := ARRAY[NEW.loja_id::text || ':' || date_trunc('month', NEW.data_despesa)::date::text];
  ELSIF TG_OP = 'DELETE' THEN
    v_keys := ARRAY[OLD.loja_id::text || ':' || date_trunc('month', OLD.data_despesa)::date::text];
  ELSE
    v_keys := ARRAY[
      OLD.loja_id::text || ':' || date_trunc('month', OLD.data_despesa)::date::text,
      NEW.loja_id::text || ':' || date_trunc('month', NEW.data_despesa)::date::text
    ];
  END IF;

  -- Deterministic ordering prevents deadlocks when an expense moves across stores/months.
  FOR v_key IN
    SELECT DISTINCT lock_key FROM unnest(v_keys) AS keys(lock_key) ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
  END LOOP;

  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
    SELECT 1
    FROM public.fechos_financeiros_loja f
    WHERE f.loja_id = OLD.loja_id
      AND f.periodo = date_trunc('month', OLD.data_despesa)::date
      AND f.estado = 'fechado'
  ) THEN
    RAISE EXCEPTION 'O período financeiro de origem desta despesa está fechado.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (
    SELECT 1
    FROM public.fechos_financeiros_loja f
    WHERE f.loja_id = NEW.loja_id
      AND f.periodo = date_trunc('month', NEW.data_despesa)::date
      AND f.estado = 'fechado'
  ) THEN
    RAISE EXCEPTION 'O período financeiro de destino desta despesa está fechado.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Reopening now takes the same advisory lock as closing before acquiring the row lock.
CREATE OR REPLACE FUNCTION public.fn_reabrir_mes_financeiro(
  p_fecho_id uuid,
  p_actor_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor public.funcionarios%ROWTYPE;
  v_row public.fechos_financeiros_loja%ROWTYPE;
  v_loja_id uuid;
  v_periodo date;
BEGIN
  SELECT * INTO v_actor
  FROM public.funcionarios
  WHERE id = p_actor_id AND ativo = true AND role = 'admin';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apenas um administrador activo pode reabrir o mês.'
      USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'O motivo da reabertura é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  -- Read the lock key without locking the row; the advisory lock is always first.
  SELECT loja_id, periodo INTO v_loja_id, v_periodo
  FROM public.fechos_financeiros_loja
  WHERE id = p_fecho_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fecho não encontrado ou já reaberto.'
      USING ERRCODE = '55000';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_loja_id::text || ':' || v_periodo::text, 0)
  );

  SELECT * INTO v_row
  FROM public.fechos_financeiros_loja
  WHERE id = p_fecho_id
  FOR UPDATE;
  IF NOT FOUND OR v_row.estado <> 'fechado'
     OR v_row.loja_id <> v_loja_id OR v_row.periodo <> v_periodo THEN
    RAISE EXCEPTION 'Fecho não encontrado ou já reaberto.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.fechos_financeiros_loja
  SET estado = 'reaberto',
      reaberto_por = p_actor_id,
      reaberto_em = now(),
      motivo_reabertura = trim(p_motivo),
      updated_at = now()
  WHERE id = p_fecho_id
  RETURNING * INTO v_row;

  INSERT INTO public.fechos_financeiros_eventos
    (fecho_id, loja_id, periodo, acao, actor_id, motivo, snapshot)
  VALUES
    (v_row.id, v_row.loja_id, v_row.periodo, 'reaberto',
     p_actor_id, trim(p_motivo), to_jsonb(v_row));

  RETURN to_jsonb(v_row);
END;
$$;

-- All payment writes must pass through the authenticated admin API using service_role.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.transacoes_financeiras FROM authenticated;
GRANT SELECT ON TABLE public.transacoes_financeiras TO authenticated;
GRANT ALL ON TABLE public.transacoes_financeiras TO service_role;

DROP POLICY IF EXISTS transacoes_financeiras_admin_insert ON public.transacoes_financeiras;
DROP POLICY IF EXISTS transacoes_financeiras_admin_update ON public.transacoes_financeiras;

DROP POLICY IF EXISTS transacoes_financeiras_admin_select ON public.transacoes_financeiras;
CREATE POLICY transacoes_financeiras_admin_select
ON public.transacoes_financeiras
FOR SELECT TO authenticated
USING (public.is_admin());

REVOKE ALL ON FUNCTION public.fn_guard_despesa_fecho_mensal()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_reabrir_mes_financeiro(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reabrir_mes_financeiro(uuid, uuid, text)
TO service_role;
