-- Preserve acquisition cost at piece level and aggregate it into each
-- refining batch. Costs are snapshots from the originating gold purchase.
ALTER TABLE public.ouro_fundicao_lote_pecas
  ADD COLUMN IF NOT EXISTS custo_aquisicao numeric(14,2);

ALTER TABLE public.ouro_fundicao_lotes
  ADD COLUMN IF NOT EXISTS custo_aquisicao_total numeric(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.snapshot_ouro_fundicao_piece_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_cost numeric(14,2);
BEGIN
  IF NEW.transacao_origem_id IS NULL THEN
    RAISE EXCEPTION 'A peça não tem transacção de compra associada.'
      USING ERRCODE = '23514';
  END IF;

  SELECT round(t.valor_final, 2)
  INTO v_cost
  FROM public.transacoes t
  WHERE t.id = NEW.transacao_origem_id;

  IF v_cost IS NULL OR v_cost < 0 THEN
    RAISE EXCEPTION 'Não foi possível apurar o custo da compra de origem.'
      USING ERRCODE = '23514';
  END IF;

  NEW.custo_aquisicao := v_cost;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_ouro_fundicao_batch_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  UPDATE public.ouro_fundicao_lotes
  SET custo_aquisicao_total = (
    SELECT coalesce(sum(custo_aquisicao), 0)
    FROM public.ouro_fundicao_lote_pecas
    WHERE lote_id = NEW.lote_id
  )
  WHERE id = NEW.lote_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_snapshot_ouro_fundicao_piece_cost
  ON public.ouro_fundicao_lote_pecas;
CREATE TRIGGER trg_snapshot_ouro_fundicao_piece_cost
BEFORE INSERT ON public.ouro_fundicao_lote_pecas
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_ouro_fundicao_piece_cost();

DROP TRIGGER IF EXISTS trg_refresh_ouro_fundicao_batch_cost
  ON public.ouro_fundicao_lote_pecas;
CREATE TRIGGER trg_refresh_ouro_fundicao_batch_cost
AFTER INSERT ON public.ouro_fundicao_lote_pecas
FOR EACH ROW
EXECUTE FUNCTION public.refresh_ouro_fundicao_batch_cost();

-- Backfill existing batch-piece links using the immutable purchase transaction.
UPDATE public.ouro_fundicao_lote_pecas AS piece
SET custo_aquisicao = round(transaction.valor_final, 2)
FROM public.transacoes AS transaction
WHERE transaction.id = piece.transacao_origem_id
  AND piece.custo_aquisicao IS NULL;

UPDATE public.ouro_fundicao_lotes AS batch
SET custo_aquisicao_total = totals.total
FROM (
  SELECT lote_id, coalesce(sum(custo_aquisicao), 0)::numeric(14,2) AS total
  FROM public.ouro_fundicao_lote_pecas
  GROUP BY lote_id
) AS totals
WHERE totals.lote_id = batch.id;

COMMENT ON COLUMN public.ouro_fundicao_lote_pecas.custo_aquisicao IS
  'Snapshot do valor pago na transacção original da peça.';
COMMENT ON COLUMN public.ouro_fundicao_lotes.custo_aquisicao_total IS
  'Soma do custo de aquisição das peças incluídas no lote; não inclui transporte nem processamento.';
