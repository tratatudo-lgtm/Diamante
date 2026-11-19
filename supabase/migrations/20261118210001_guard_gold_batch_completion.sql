-- Fail closed if either physical hand-off or refining completion lacks
-- an auditable actor/batch. Also prevent closing a batch whose pieces are no
-- longer all reserved in the expected inventory state.
CREATE OR REPLACE FUNCTION public.audit_ouro_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_event text;
  v_operator uuid;
  v_batch_id uuid;
  v_event_at timestamptz;
  v_notes text;
BEGIN
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'enviado_sede' THEN
    v_event := 'expedicao_sede';
    v_operator := NEW.expedido_por;
    v_event_at := coalesce(NEW.data_saida, now());
  ELSIF NEW.estado = 'recebido_sede' THEN
    v_event := 'recepcao_sede';
    v_operator := NEW.recebido_por;
    v_event_at := coalesce(NEW.data_rececao, now());
    v_notes := NEW.observacoes_rececao;
  ELSIF NEW.estado = 'em_lote_fundicao' THEN
    v_event := 'entrada_fundicao';
    v_batch_id := (
      SELECT piece.lote_id
      FROM public.ouro_fundicao_lote_pecas AS piece
      WHERE piece.inventario_id = NEW.id
    );
    v_operator := NEW.fundicao_por;
    v_event_at := now();
    IF v_batch_id IS NULL OR v_operator IS NULL THEN
      RAISE EXCEPTION 'A entrada em fundição exige lote e operador responsáveis para a peça %.', NEW.id
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.estado = 'fundido' THEN
    v_event := 'fundicao_concluida';
    SELECT piece.lote_id, batch.concluido_por, batch.concluido_em, batch.observacoes
      INTO v_batch_id, v_operator, v_event_at, v_notes
    FROM public.ouro_fundicao_lote_pecas AS piece
    JOIN public.ouro_fundicao_lotes AS batch
      ON batch.id = piece.lote_id
    WHERE piece.inventario_id = NEW.id
      AND batch.estado = 'concluido';

    IF v_batch_id IS NULL OR v_operator IS NULL THEN
      RAISE EXCEPTION 'Não existe lote concluído e auditável associado à peça %.', NEW.id
        USING ERRCODE = '23514';
    END IF;
    v_event_at := coalesce(v_event_at, now());
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.ouro_movimentos_fisicos (
    inventario_id, evento, estado_anterior, estado_novo, loja_id,
    peso_declarado_gramas, peso_recebido_gramas, diferenca_peso_gramas,
    operador_id, ocorrido_em, observacoes, lote_fundicao_id
  ) VALUES (
    NEW.id, v_event, OLD.estado, NEW.estado, NEW.loja_atual_id,
    NEW.peso_gramas, NEW.peso_recebido_gramas, NEW.diferenca_peso_gramas,
    v_operator, coalesce(v_event_at, now()), v_notes, v_batch_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_ouro_batch_completion_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_piece_count integer;
  v_reserved_count integer;
BEGIN
  IF OLD.estado IS DISTINCT FROM 'concluido'
     AND NEW.estado = 'concluido' THEN
    SELECT count(*)::integer,
           count(*) FILTER (WHERE inventory.estado = 'em_lote_fundicao')::integer
      INTO v_piece_count, v_reserved_count
    FROM public.ouro_fundicao_lote_pecas AS piece
    LEFT JOIN public.inventario_fisico AS inventory
      ON inventory.id = piece.inventario_id
    WHERE piece.lote_id = NEW.id;

    IF v_piece_count < 1
       OR v_piece_count <> NEW.quantidade_pecas
       OR v_reserved_count <> v_piece_count THEN
      RAISE EXCEPTION 'Não é possível concluir o lote: nem todas as peças estão reservadas em fundição.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_ouro_inventory_movement()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_ouro_batch_completion_inventory()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_ouro_batch_completion_inventory
  ON public.ouro_fundicao_lotes;
CREATE TRIGGER trg_guard_ouro_batch_completion_inventory
BEFORE UPDATE OF estado ON public.ouro_fundicao_lotes
FOR EACH ROW
EXECUTE FUNCTION public.guard_ouro_batch_completion_inventory();

COMMENT ON FUNCTION public.guard_ouro_batch_completion_inventory() IS
  'Impede a conclusão de lotes se o número de peças divergir ou se alguma peça já não estiver reservada em fundição.';
