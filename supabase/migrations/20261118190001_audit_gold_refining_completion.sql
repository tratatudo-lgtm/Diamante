-- Complete the append-only custody ledger when a refining batch is finalized.
-- The event is inserted by the existing inventory state trigger, in the same
-- transaction as concluir_lote_ouro_fundicao updates the inventory rows.

ALTER TABLE public.ouro_movimentos_fisicos
  DROP CONSTRAINT IF EXISTS ouro_movimentos_fisicos_evento_check;

ALTER TABLE public.ouro_movimentos_fisicos
  ADD CONSTRAINT ouro_movimentos_fisicos_evento_check
  CHECK (evento IN (
    'expedicao_sede',
    'recepcao_sede',
    'entrada_fundicao',
    'fundicao_concluida'
  ));

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
    SELECT piece.lote_id, inventory.fundicao_por
      INTO v_batch_id, v_operator
    FROM public.ouro_fundicao_lote_pecas AS piece
    JOIN public.inventario_fisico AS inventory
      ON inventory.id = piece.inventario_id
    WHERE piece.inventario_id = NEW.id;
    v_event_at := now();
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
    inventario_id,
    evento,
    estado_anterior,
    estado_novo,
    loja_id,
    peso_declarado_gramas,
    peso_recebido_gramas,
    diferenca_peso_gramas,
    operador_id,
    ocorrido_em,
    observacoes,
    lote_fundicao_id
  ) VALUES (
    NEW.id,
    v_event,
    OLD.estado,
    NEW.estado,
    NEW.loja_atual_id,
    NEW.peso_gramas,
    NEW.peso_recebido_gramas,
    NEW.diferenca_peso_gramas,
    v_operator,
    coalesce(v_event_at, now()),
    v_notes,
    v_batch_id
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_ouro_inventory_movement()
  FROM PUBLIC, anon, authenticated;

COMMENT ON CONSTRAINT ouro_movimentos_fisicos_evento_check
  ON public.ouro_movimentos_fisicos IS
  'Inclui a conclusão da fundição como evento físico imutável, associado ao lote e ao administrador que o concluiu.';
