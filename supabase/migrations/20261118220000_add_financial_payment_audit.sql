-- Immutable audit trail for administrative payment state transitions.
ALTER TABLE public.transacoes_financeiras
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS pago_por uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitado_por uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

CREATE TABLE IF NOT EXISTS public.transacoes_financeiras_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid NOT NULL REFERENCES public.transacoes_financeiras(id) ON DELETE RESTRICT,
  acao text NOT NULL CHECK (acao IN ('criado', 'marcado_pago', 'rejeitado')),
  estado_anterior text,
  estado_novo text NOT NULL CHECK (estado_novo IN ('pendente', 'pago', 'rejeitado')),
  actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  motivo text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Older payments predate actor/timestamp audit fields. Preserve their current
-- state as an explicitly imported legacy snapshot; never fabricate an actor
-- or claim that the original transition timestamp is known.
ALTER TABLE public.transacoes_financeiras_eventos
  ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.transacoes_financeiras_eventos
  DROP CONSTRAINT IF EXISTS transacoes_financeiras_eventos_acao_check;
ALTER TABLE public.transacoes_financeiras_eventos
  ADD CONSTRAINT transacoes_financeiras_eventos_acao_check
  CHECK (acao IN ('criado', 'marcado_pago', 'rejeitado', 'legacy_import'));

INSERT INTO public.transacoes_financeiras_eventos (
  transacao_id, acao, estado_anterior, estado_novo,
  actor_id, motivo, snapshot, created_at
)
SELECT
  payment.id,
  'legacy_import',
  NULL,
  payment.estado,
  NULL,
  CASE WHEN payment.motivo_rejeicao IS NOT NULL
       THEN payment.motivo_rejeicao
       ELSE 'Registo anterior à activação do histórico de auditoria.'
  END,
  jsonb_build_object(
    'legacy_import', true,
    'actor_not_recorded', true,
    'transition_timestamp_not_available', true,
    'referencia', payment.referencia,
    'loja_id', payment.loja_id,
    'valor', payment.valor,
    'metodo', payment.metodo,
    'estado_actual_na_migracao', payment.estado,
    'created_at_original', payment.created_at
  ),
  payment.created_at
FROM public.transacoes_financeiras AS payment
WHERE NOT EXISTS (
  SELECT 1
  FROM public.transacoes_financeiras_eventos AS event
  WHERE event.transacao_id = payment.id
);

CREATE INDEX IF NOT EXISTS transacoes_financeiras_eventos_payment_idx
  ON public.transacoes_financeiras_eventos(transacao_id, created_at, id);

ALTER TABLE public.transacoes_financeiras_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transacoes_financeiras_eventos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.transacoes_financeiras_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.fn_guard_financial_payment_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Os pagamentos não podem ser eliminados; preserve o histórico financeiro.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_actor := NEW.criado_por;
    IF v_actor IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.funcionarios f
      WHERE f.id = v_actor AND f.ativo = true AND f.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'O registo do pagamento exige um administrador activo.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.referencia IS DISTINCT FROM OLD.referencia
     OR NEW.loja_id IS DISTINCT FROM OLD.loja_id
     OR NEW.loja_nome IS DISTINCT FROM OLD.loja_nome
     OR NEW.beneficiario_nome IS DISTINCT FROM OLD.beneficiario_nome
     OR NEW.beneficiario_nif IS DISTINCT FROM OLD.beneficiario_nif
     OR NEW.beneficiario_iban IS DISTINCT FROM OLD.beneficiario_iban
     OR NEW.valor IS DISTINCT FROM OLD.valor
     OR NEW.metodo IS DISTINCT FROM OLD.metodo
     OR NEW.conta_origem IS DISTINCT FROM OLD.conta_origem
     OR NEW.descricao IS DISTINCT FROM OLD.descricao
     OR NEW.peso_ouro_gramas IS DISTINCT FROM OLD.peso_ouro_gramas
     OR NEW.tipo_metal IS DISTINCT FROM OLD.tipo_metal
     OR NEW.operador_nome IS DISTINCT FROM OLD.operador_nome
     OR NEW.comprovativo_ref IS DISTINCT FROM OLD.comprovativo_ref
     OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.hora IS DISTINCT FROM OLD.hora
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.criado_por IS DISTINCT FROM OLD.criado_por THEN
    RAISE EXCEPTION 'Os dados originais do pagamento são imutáveis.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'Apenas é permitida uma transição de estado por pagamento.'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.estado <> 'pendente' OR NEW.estado NOT IN ('pago', 'rejeitado') THEN
    RAISE EXCEPTION 'Transição de estado de pagamento inválida.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.estado = 'pago' THEN
    v_actor := NEW.pago_por;
    IF v_actor IS NULL OR NEW.paid_at IS NULL
       OR NEW.rejeitado_por IS NOT NULL OR NEW.rejected_at IS NOT NULL
       OR NEW.motivo_rejeicao IS NOT NULL THEN
      RAISE EXCEPTION 'A confirmação exige actor e data; não pode conter dados de rejeição.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    v_actor := NEW.rejeitado_por;
    IF v_actor IS NULL OR NEW.rejected_at IS NULL
       OR length(btrim(coalesce(NEW.motivo_rejeicao, ''))) < 5
       OR NEW.pago_por IS NOT NULL OR NEW.paid_at IS NOT NULL THEN
      RAISE EXCEPTION 'A rejeição exige actor, data e motivo.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = v_actor AND f.ativo = true AND f.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'A transição exige um administrador activo.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_financial_payment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_action text;
  v_reason text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := NEW.criado_por;
    v_action := 'criado';
  ELSIF NEW.estado = 'pago' THEN
    v_actor := NEW.pago_por;
    v_action := 'marcado_pago';
  ELSE
    v_actor := NEW.rejeitado_por;
    v_action := 'rejeitado';
    v_reason := NEW.motivo_rejeicao;
  END IF;

  INSERT INTO public.transacoes_financeiras_eventos (
    transacao_id, acao, estado_anterior, estado_novo,
    actor_id, motivo, snapshot
  ) VALUES (
    NEW.id, v_action,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END,
    NEW.estado, v_actor, v_reason,
    jsonb_build_object(
      'referencia', NEW.referencia,
      'loja_id', NEW.loja_id,
      'valor', NEW.valor,
      'metodo', NEW.metodo,
      'estado', NEW.estado,
      'paid_at', NEW.paid_at,
      'rejected_at', NEW.rejected_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_financial_payment_mutation ON public.transacoes_financeiras;
CREATE TRIGGER trg_guard_financial_payment_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.transacoes_financeiras
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_financial_payment_mutation();

DROP TRIGGER IF EXISTS trg_audit_financial_payment_event ON public.transacoes_financeiras;
CREATE TRIGGER trg_audit_financial_payment_event
AFTER INSERT OR UPDATE ON public.transacoes_financeiras
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_financial_payment_event();

CREATE OR REPLACE FUNCTION public.fn_protect_financial_payment_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de pagamentos é imutável.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_financial_payment_events ON public.transacoes_financeiras_eventos;
CREATE TRIGGER trg_protect_financial_payment_events
BEFORE UPDATE OR DELETE ON public.transacoes_financeiras_eventos
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_financial_payment_events();

REVOKE ALL ON FUNCTION public.fn_guard_financial_payment_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_audit_financial_payment_event()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_protect_financial_payment_events()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.transacoes_financeiras_eventos IS
  'Histórico append-only das transições administrativas de pagamentos; não constitui prova bancária de liquidação.';
