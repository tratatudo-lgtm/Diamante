-- Protect monthly closing snapshots and retain the identity references in audit events.
ALTER TABLE public.fechos_financeiros_eventos
  DROP CONSTRAINT IF EXISTS fechos_financeiros_eventos_actor_id_fkey;
ALTER TABLE public.fechos_financeiros_eventos
  ADD CONSTRAINT fechos_financeiros_eventos_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.funcionarios(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.fn_guard_fecho_financeiro_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Os fechos financeiros não podem ser eliminados.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.loja_id IS DISTINCT FROM OLD.loja_id
     OR NEW.periodo IS DISTINCT FROM OLD.periodo
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A identidade do fecho financeiro é imutável.'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.estado = 'fechado' AND NEW.estado = 'reaberto' THEN
    IF NEW.total_pago IS DISTINCT FROM OLD.total_pago
       OR NEW.total_pendente IS DISTINCT FROM OLD.total_pendente
       OR NEW.total_rejeitado IS DISTINCT FROM OLD.total_rejeitado
       OR NEW.quantidade_despesas IS DISTINCT FROM OLD.quantidade_despesas
       OR NEW.snapshot_categorias IS DISTINCT FROM OLD.snapshot_categorias
       OR NEW.fechado_por IS DISTINCT FROM OLD.fechado_por
       OR NEW.fechado_em IS DISTINCT FROM OLD.fechado_em
       OR NEW.reaberto_por IS NULL OR NEW.reaberto_em IS NULL
       OR length(btrim(coalesce(NEW.motivo_reabertura, ''))) < 5 THEN
      RAISE EXCEPTION 'A reabertura não pode alterar o snapshot; exige responsável, data e motivo.'
        USING ERRCODE = '23514';
    END IF;
    v_actor := NEW.reaberto_por;
  ELSIF OLD.estado = 'reaberto' AND NEW.estado = 'fechado' THEN
    IF NEW.fechado_por IS NULL OR NEW.fechado_em IS NULL
       OR NEW.reaberto_por IS NOT NULL OR NEW.reaberto_em IS NOT NULL
       OR NEW.motivo_reabertura IS NOT NULL THEN
      RAISE EXCEPTION 'O novo fecho exige responsável e data, sem metadados de reabertura.'
        USING ERRCODE = '23514';
    END IF;
    v_actor := NEW.fechado_por;
  ELSE
    RAISE EXCEPTION 'Transição do fecho financeiro inválida.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = v_actor AND f.ativo = true AND f.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'A operação exige um administrador activo.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_fecho_financeiro_mutation ON public.fechos_financeiros_loja;
CREATE TRIGGER trg_guard_fecho_financeiro_mutation
BEFORE UPDATE OR DELETE ON public.fechos_financeiros_loja
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_fecho_financeiro_mutation();

REVOKE ALL ON FUNCTION public.fn_guard_fecho_financeiro_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
