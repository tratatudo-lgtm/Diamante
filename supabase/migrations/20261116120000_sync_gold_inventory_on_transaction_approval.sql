-- Keep the physical gold inventory in sync with the approval lifecycle.
-- The inventory item is created as pending; it becomes dispatchable only
-- when its originating purchase transaction is finally approved.
CREATE OR REPLACE FUNCTION public.sync_gold_inventory_after_transaction_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.estado = 'pendente_aprovacao'
     AND NEW.estado = 'aprovado' THEN
    UPDATE public.inventario_fisico
       SET estado = 'em_loja'
     WHERE transacao_origem_id = NEW.id
       AND estado = 'pendente_aprovacao';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_gold_inventory_after_transaction_approval
  ON public.transacoes;

CREATE TRIGGER trg_sync_gold_inventory_after_transaction_approval
AFTER UPDATE OF estado ON public.transacoes
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION public.sync_gold_inventory_after_transaction_approval();
