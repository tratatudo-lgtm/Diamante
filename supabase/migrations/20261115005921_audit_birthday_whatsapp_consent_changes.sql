CREATE TABLE IF NOT EXISTS public.whatsapp_aniversarios_consentimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  consentimento_anterior boolean NOT NULL,
  consentimento_novo boolean NOT NULL,
  registado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (consentimento_anterior IS DISTINCT FROM consentimento_novo)
);

CREATE INDEX IF NOT EXISTS whatsapp_aniversarios_consentimentos_cliente_data_idx
  ON public.whatsapp_aniversarios_consentimentos (cliente_id, registado_em DESC);

ALTER TABLE public.whatsapp_aniversarios_consentimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_aniversarios_consentimentos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.whatsapp_aniversarios_consentimentos TO service_role;

CREATE OR REPLACE FUNCTION public.set_client_birthday_whatsapp_consent(
  p_client_id uuid,
  p_consent boolean,
  p_employee_id uuid
)
RETURNS TABLE (cliente_id uuid, consentimento boolean, alterado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_employee_store uuid;
  v_client_store uuid;
  v_previous boolean;
BEGIN
  SELECT lower(f.role), f.loja_id
    INTO v_role, v_employee_store
  FROM public.funcionarios AS f
  WHERE f.id = p_employee_id AND f.ativo = true;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'funcionario') THEN
    RAISE EXCEPTION 'Funcionário sem autorização activa.';
  END IF;

  SELECT c.loja_registo_id, c.consentimento_whatsapp_aniversario
    INTO v_client_store, v_previous
  FROM public.clientes AS c
  WHERE c.id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_role <> 'admin' AND (v_employee_store IS NULL OR v_employee_store <> v_client_store) THEN
    RAISE EXCEPTION 'Cliente fora do âmbito da loja do funcionário.';
  END IF;

  IF v_previous IS DISTINCT FROM p_consent THEN
    UPDATE public.clientes
      SET consentimento_whatsapp_aniversario = p_consent,
          consentimento_whatsapp_aniversario_data = now()
    WHERE id = p_client_id;

    INSERT INTO public.whatsapp_aniversarios_consentimentos
      (cliente_id, funcionario_id, loja_id, consentimento_anterior, consentimento_novo)
    VALUES
      (p_client_id, p_employee_id, v_client_store, v_previous, p_consent);
  END IF;

  RETURN QUERY SELECT p_client_id, p_consent, (v_previous IS DISTINCT FROM p_consent);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_client_birthday_whatsapp_consent(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_client_birthday_whatsapp_consent(uuid, boolean, uuid) TO service_role;
