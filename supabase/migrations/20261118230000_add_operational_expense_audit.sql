-- Append-only audit trail and database-enforced state transitions for operational expenses.
ALTER TABLE public.despesas_operacionais
  ADD COLUMN IF NOT EXISTS rejeitado_por uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

CREATE TABLE IF NOT EXISTS public.despesas_operacionais_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id uuid NOT NULL REFERENCES public.despesas_operacionais(id) ON DELETE RESTRICT,
  acao text NOT NULL CHECK (acao IN ('criada', 'aprovada', 'rejeitada', 'paga', 'legacy_import')),
  estado_anterior text,
  estado_novo text NOT NULL CHECK (estado_novo IN ('pendente', 'aprovada', 'rejeitada', 'paga')),
  actor_id uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  motivo text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Import the current state of existing rows without inventing the original actor
-- or transition timestamp. created_at_original remains data, not event time.
INSERT INTO public.despesas_operacionais_eventos (
  despesa_id, acao, estado_anterior, estado_novo, actor_id, motivo, snapshot
)
SELECT
  expense.id,
  'legacy_import',
  NULL,
  expense.estado,
  NULL,
  COALESCE(expense.motivo_rejeicao, 'Registo anterior à activação do histórico de auditoria.'),
  jsonb_build_object(
    'legacy_import', true,
    'actor_not_recorded', true,
    'transition_timestamp_not_available', true,
    'loja_id', expense.loja_id,
    'categoria', expense.categoria,
    'valor', expense.valor,
    'data_despesa', expense.data_despesa,
    'estado_actual_na_migracao', expense.estado,
    'created_at_original', expense.created_at
  )
FROM public.despesas_operacionais AS expense
WHERE NOT EXISTS (
  SELECT 1 FROM public.despesas_operacionais_eventos AS event
  WHERE event.despesa_id = expense.id
);

CREATE INDEX IF NOT EXISTS despesas_operacionais_eventos_despesa_idx
  ON public.despesas_operacionais_eventos(despesa_id, created_at, id);

ALTER TABLE public.despesas_operacionais_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.despesas_operacionais_eventos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.despesas_operacionais_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.fn_guard_despesa_operacional_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'As despesas não podem ser eliminadas; preserve o histórico financeiro.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_actor := NEW.criado_por;
    IF NEW.estado <> 'pendente' OR v_actor IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.funcionarios f
      WHERE f.id = v_actor AND f.ativo = true AND f.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'O registo da despesa exige um administrador activo e estado pendente.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.aprovado_por IS NOT NULL OR NEW.approved_at IS NOT NULL
       OR NEW.pago_por IS NOT NULL OR NEW.paid_at IS NOT NULL
       OR NEW.rejeitado_por IS NOT NULL OR NEW.rejected_at IS NOT NULL
       OR NEW.motivo_rejeicao IS NOT NULL THEN
      RAISE EXCEPTION 'Uma despesa nova não pode conter dados de transições anteriores.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.loja_id IS DISTINCT FROM OLD.loja_id
     OR NEW.categoria IS DISTINCT FROM OLD.categoria
     OR NEW.descricao IS DISTINCT FROM OLD.descricao
     OR NEW.fornecedor IS DISTINCT FROM OLD.fornecedor
     OR NEW.referencia_documento IS DISTINCT FROM OLD.referencia_documento
     OR NEW.valor IS DISTINCT FROM OLD.valor
     OR NEW.data_despesa IS DISTINCT FROM OLD.data_despesa
     OR NEW.comprovativo_ref IS DISTINCT FROM OLD.comprovativo_ref
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.criado_por IS DISTINCT FROM OLD.criado_por THEN
    RAISE EXCEPTION 'Os dados originais da despesa são imutáveis.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'Apenas são permitidas transições válidas de estado.'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.estado = 'pendente' AND NEW.estado = 'aprovada' THEN
    v_actor := NEW.aprovado_por;
    IF v_actor IS NULL OR NEW.approved_at IS NULL
       OR NEW.pago_por IS NOT NULL OR NEW.paid_at IS NOT NULL
       OR NEW.rejeitado_por IS NOT NULL OR NEW.rejected_at IS NOT NULL
       OR NEW.motivo_rejeicao IS NOT NULL THEN
      RAISE EXCEPTION 'A aprovação exige administrador e data, sem dados de pagamento/rejeição.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.estado = 'pendente' AND NEW.estado = 'rejeitada' THEN
    v_actor := NEW.rejeitado_por;
    IF v_actor IS NULL OR NEW.rejected_at IS NULL
       OR length(btrim(coalesce(NEW.motivo_rejeicao, ''))) < 3
       OR NEW.aprovado_por IS NOT NULL OR NEW.approved_at IS NOT NULL
       OR NEW.pago_por IS NOT NULL OR NEW.paid_at IS NOT NULL THEN
      RAISE EXCEPTION 'A rejeição exige administrador, data e motivo.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.estado = 'aprovada' AND NEW.estado = 'paga' THEN
    v_actor := NEW.pago_por;
    IF v_actor IS NULL OR NEW.paid_at IS NULL
       OR NEW.aprovado_por IS NULL OR NEW.approved_at IS NULL
       OR NEW.rejeitado_por IS NOT NULL OR NEW.rejected_at IS NOT NULL
       OR NEW.motivo_rejeicao IS NOT NULL THEN
      RAISE EXCEPTION 'O pagamento exige aprovação anterior e administrador responsável.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Transição de estado da despesa inválida.'
      USING ERRCODE = '55000';
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

CREATE OR REPLACE FUNCTION public.fn_audit_despesa_operacional_event()
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
    v_action := 'criada';
  ELSIF NEW.estado = 'aprovada' THEN
    v_actor := NEW.aprovado_por;
    v_action := 'aprovada';
  ELSIF NEW.estado = 'rejeitada' THEN
    v_actor := NEW.rejeitado_por;
    v_action := 'rejeitada';
    v_reason := NEW.motivo_rejeicao;
  ELSE
    v_actor := NEW.pago_por;
    v_action := 'paga';
  END IF;

  INSERT INTO public.despesas_operacionais_eventos (
    despesa_id, acao, estado_anterior, estado_novo, actor_id, motivo, snapshot
  ) VALUES (
    NEW.id, v_action,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END,
    NEW.estado, v_actor, v_reason,
    jsonb_build_object(
      'loja_id', NEW.loja_id,
      'categoria', NEW.categoria,
      'valor', NEW.valor,
      'data_despesa', NEW.data_despesa,
      'estado', NEW.estado,
      'approved_at', NEW.approved_at,
      'paid_at', NEW.paid_at,
      'rejected_at', NEW.rejected_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_despesa_operacional_mutation ON public.despesas_operacionais;
CREATE TRIGGER trg_guard_despesa_operacional_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.despesas_operacionais
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_despesa_operacional_mutation();

DROP TRIGGER IF EXISTS trg_audit_despesa_operacional_event ON public.despesas_operacionais;
CREATE TRIGGER trg_audit_despesa_operacional_event
AFTER INSERT OR UPDATE ON public.despesas_operacionais
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_despesa_operacional_event();

CREATE OR REPLACE FUNCTION public.fn_protect_despesa_operacional_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de despesas é imutável.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_despesa_operacional_events ON public.despesas_operacionais_eventos;
CREATE TRIGGER trg_protect_despesa_operacional_events
BEFORE UPDATE OR DELETE ON public.despesas_operacionais_eventos
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_despesa_operacional_events();

REVOKE ALL ON FUNCTION public.fn_guard_despesa_operacional_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_audit_despesa_operacional_event()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_protect_despesa_operacional_events()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.despesas_operacionais_eventos IS
  'Histórico append-only das transições de despesas operacionais; os registos legacy não inventam responsáveis nem datas de transição.';
