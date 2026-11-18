-- Correct monthly-close guards and keep payment writes behind the admin API.
-- This migration is intentionally additive and does not rewrite historical rows.

CREATE OR REPLACE FUNCTION public.fn_guard_despesa_fecho_mensal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_key text;
  v_new_key text;
  v_lock_key text;
  v_old_period date;
  v_new_period date;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_period := date_trunc('month', OLD.data_despesa)::date;
    v_old_key := OLD.loja_id::text || ':' || v_old_period::text;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_period := date_trunc('month', NEW.data_despesa)::date;
    v_new_key := NEW.loja_id::text || ':' || v_new_period::text;
  END IF;

  -- Acquire both affected period locks in a stable order. This serializes
  -- cross-store/cross-month moves without creating lock-order inversions.
  FOR v_lock_key IN
    SELECT DISTINCT key_value
    FROM unnest(ARRAY[v_old_key, v_new_key]) AS keys(key_value)
    WHERE key_value IS NOT NULL
    ORDER BY key_value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  IF v_old_key IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.fechos_financeiros_loja f
    WHERE f.loja_id = OLD.loja_id
      AND f.periodo = v_old_period
      AND f.estado = 'fechado'
  ) THEN
    RAISE EXCEPTION 'O período financeiro de origem está fechado.'
      USING ERRCODE = '55000';
  END IF;

  IF v_new_key IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.fechos_financeiros_loja f
    WHERE f.loja_id = NEW.loja_id
      AND f.periodo = v_new_period
      AND f.estado = 'fechado'
  ) THEN
    RAISE EXCEPTION 'O período financeiro de destino está fechado.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

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
  v_lock_key text;
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

  -- Read the lock identity first without holding a row lock. Every operation
  -- on this store/month takes the advisory lock before touching the closing row.
  SELECT * INTO v_row
  FROM public.fechos_financeiros_loja
  WHERE id = p_fecho_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fecho não encontrado ou já reaberto.'
      USING ERRCODE = '55000';
  END IF;

  v_lock_key := v_row.loja_id::text || ':' || v_row.periodo::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  SELECT * INTO v_row
  FROM public.fechos_financeiros_loja
  WHERE id = p_fecho_id
  FOR UPDATE;
  IF NOT FOUND OR v_row.estado <> 'fechado' THEN
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
    (v_row.id, v_row.loja_id, v_row.periodo, 'reaberto', p_actor_id,
     trim(p_motivo), to_jsonb(v_row));

  RETURN to_jsonb(v_row);
END;
$$;

-- Authenticated administrators must use the verifyAdmin API routes. Direct
-- table writes would bypass conditional state transitions and audit metadata.
REVOKE INSERT, UPDATE ON TABLE public.transacoes_financeiras FROM authenticated;
DROP POLICY IF EXISTS transacoes_financeiras_admin_insert ON public.transacoes_financeiras;
DROP POLICY IF EXISTS transacoes_financeiras_admin_update ON public.transacoes_financeiras;
GRANT ALL ON TABLE public.transacoes_financeiras TO service_role;
