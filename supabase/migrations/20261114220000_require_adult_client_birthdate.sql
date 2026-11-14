-- Data de nascimento obrigatória e validação de maioridade dos clientes
-- Os registos históricos sem data são preservados; novos registos não podem omiti-la.
ALTER TABLE public.clientes
  ALTER COLUMN data_nascimento TYPE date
  USING NULLIF(BTRIM(data_nascimento), '')::date;

CREATE OR REPLACE FUNCTION public.validar_maioridade_cliente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.data_nascimento IS NULL THEN
    RAISE EXCEPTION 'A data de nascimento é obrigatória.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.data_nascimento IS DISTINCT FROM OLD.data_nascimento
     AND NEW.data_nascimento IS NULL THEN
    RAISE EXCEPTION 'A data de nascimento é obrigatória.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.data_nascimento IS NOT NULL
     AND NEW.data_nascimento > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'O cliente tem de ter pelo menos 18 anos.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_maioridade_cliente ON public.clientes;
CREATE TRIGGER trg_validar_maioridade_cliente
BEFORE INSERT OR UPDATE OF data_nascimento
ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.validar_maioridade_cliente();

COMMENT ON COLUMN public.clientes.data_nascimento IS
  'Data de nascimento do cliente. Obrigatória em novos registos; o backend e o trigger validam idade mínima de 18 anos.';

REVOKE ALL ON FUNCTION public.validar_maioridade_cliente() FROM PUBLIC, anon, authenticated;
