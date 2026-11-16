-- Financial settlement records are append-only: corrections must be recorded
-- as explicit compensating entries, never by rewriting historical sales.
CREATE OR REPLACE FUNCTION public.prevent_ouro_fundicao_liquidacao_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'Registos de liquidação são imutáveis; registe um movimento compensatório.'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_ouro_fundicao_liquidacao_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ouro_fundicao_liquidacoes_immutable
  ON public.ouro_fundicao_liquidacoes;

CREATE TRIGGER trg_ouro_fundicao_liquidacoes_immutable
  BEFORE UPDATE OR DELETE ON public.ouro_fundicao_liquidacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ouro_fundicao_liquidacao_mutation();
