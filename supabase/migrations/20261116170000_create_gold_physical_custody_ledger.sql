-- Append-only physical custody ledger for gold inventory transitions.
ALTER TABLE public.inventario_fisico
  ADD COLUMN IF NOT EXISTS expedido_por uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.ouro_movimentos_fisicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id uuid NOT NULL REFERENCES public.inventario_fisico(id) ON DELETE RESTRICT,
  evento text NOT NULL CHECK (evento IN ('expedicao_sede','recepcao_sede')),
  estado_anterior text,
  estado_novo text NOT NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE RESTRICT,
  peso_declarado_gramas numeric(12,3),
  peso_recebido_gramas numeric(12,3),
  diferenca_peso_gramas numeric(12,3),
  operador_id uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  observacoes text,
  CONSTRAINT ouro_movimentos_peso_check CHECK (
    (peso_declarado_gramas IS NULL OR peso_declarado_gramas > 0)
    AND (peso_recebido_gramas IS NULL OR peso_recebido_gramas > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_ouro_movimentos_inventario_data
  ON public.ouro_movimentos_fisicos(inventario_id, ocorrido_em, id);
CREATE INDEX IF NOT EXISTS idx_ouro_movimentos_operador_data
  ON public.ouro_movimentos_fisicos(operador_id, ocorrido_em)
  WHERE operador_id IS NOT NULL;

ALTER TABLE public.ouro_movimentos_fisicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ouro_movimentos_fisicos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ouro_movimentos_fisicos TO service_role;

CREATE OR REPLACE FUNCTION public.audit_ouro_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_event text;
  v_operator uuid;
BEGIN
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'enviado_sede' THEN
    v_event := 'expedicao_sede';
    v_operator := NEW.expedido_por;
  ELSIF NEW.estado = 'recebido_sede' THEN
    v_event := 'recepcao_sede';
    v_operator := NEW.recebido_por;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.ouro_movimentos_fisicos (
    inventario_id, evento, estado_anterior, estado_novo, loja_id,
    peso_declarado_gramas, peso_recebido_gramas, diferenca_peso_gramas,
    operador_id, ocorrido_em, observacoes
  ) VALUES (
    NEW.id, v_event, OLD.estado, NEW.estado, NEW.loja_atual_id,
    NEW.peso_gramas, NEW.peso_recebido_gramas, NEW.diferenca_peso_gramas,
    v_operator,
    CASE WHEN v_event = 'recepcao_sede' THEN coalesce(NEW.data_rececao, now())
         ELSE coalesce(NEW.data_saida, now()) END,
    CASE WHEN v_event = 'recepcao_sede' THEN NEW.observacoes_rececao ELSE NULL END
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_ouro_inventory_movement ON public.inventario_fisico;
CREATE TRIGGER trg_audit_ouro_inventory_movement
AFTER UPDATE OF estado ON public.inventario_fisico
FOR EACH ROW
EXECUTE FUNCTION public.audit_ouro_inventory_movement();

COMMENT ON TABLE public.ouro_movimentos_fisicos IS
  'Livro append-only dos eventos de expedição e recepção física de peças de ouro. Não substitui o estado actual do inventário.';

-- Protect the custody ledger against accidental or privileged mutation.
CREATE OR REPLACE FUNCTION public.reject_ouro_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'O livro de movimentos físicos é imutável.';
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_ouro_movement_mutation() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_ouro_movimentos_immutable ON public.ouro_movimentos_fisicos;
CREATE TRIGGER trg_ouro_movimentos_immutable
BEFORE UPDATE OR DELETE ON public.ouro_movimentos_fisicos
FOR EACH ROW
EXECUTE FUNCTION public.reject_ouro_movement_mutation();
