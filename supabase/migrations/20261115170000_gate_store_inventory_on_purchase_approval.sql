-- Gold bought in-store is not available stock until the originating
-- transaction receives its final administrative approval.
-- Reconcile existing records before enabling the approval transition hook.
UPDATE public.inventario_fisico AS inventory
SET estado = 'pendente_aprovacao'
FROM public.transacoes AS transaction
WHERE inventory.transacao_origem_id = transaction.id
  AND transaction.estado = 'pendente_aprovacao'
  AND inventory.estado = 'em_loja';

CREATE OR REPLACE FUNCTION public.promote_approved_purchase_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF OLD.estado = 'pendente_aprovacao' AND NEW.estado = 'aprovado' THEN
    UPDATE public.inventario_fisico
    SET estado = 'em_loja'
    WHERE transacao_origem_id = NEW.id
      AND estado = 'pendente_aprovacao';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.promote_approved_purchase_inventory()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_promote_approved_purchase_inventory ON public.transacoes;

CREATE TRIGGER trg_promote_approved_purchase_inventory
AFTER UPDATE OF estado ON public.transacoes
FOR EACH ROW
WHEN (OLD.estado = 'pendente_aprovacao' AND NEW.estado = 'aprovado')
EXECUTE FUNCTION public.promote_approved_purchase_inventory();
