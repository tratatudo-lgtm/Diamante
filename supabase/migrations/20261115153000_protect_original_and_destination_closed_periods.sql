CREATE OR REPLACE FUNCTION public.fn_guard_despesa_fecho_mensal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_old_month date; v_new_month date;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    v_old_month:=date_trunc('month',OLD.data_despesa)::date;
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.loja_id::text||':'||v_old_month::text,0));
    IF EXISTS(SELECT 1 FROM public.fechos_financeiros_loja f WHERE f.loja_id=OLD.loja_id AND f.periodo=v_old_month AND f.estado='fechado') THEN
      RAISE EXCEPTION 'O período financeiro original desta despesa está fechado.' USING ERRCODE='55000';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_new_month:=date_trunc('month',NEW.data_despesa)::date;
    IF TG_OP='INSERT' OR NEW.loja_id IS DISTINCT FROM OLD.loja_id OR v_new_month IS DISTINCT FROM v_old_month THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.loja_id::text||':'||v_new_month::text,0));
    END IF;
    IF EXISTS(SELECT 1 FROM public.fechos_financeiros_loja f WHERE f.loja_id=NEW.loja_id AND f.periodo=v_new_month AND f.estado='fechado') THEN
      RAISE EXCEPTION 'O período de destino desta despesa está fechado.' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
