-- Serialize each employee's time-clock transitions and enforce valid shift state.
CREATE OR REPLACE FUNCTION public.register_employee_time_clock(
  p_funcionario_id uuid,
  p_loja_id uuid,
  p_tipo text,
  p_localizacao jsonb DEFAULT NULL
)
RETURNS public.registos_ponto
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $clock$
DECLARE
  v_employee public.funcionarios%ROWTYPE;
  v_last_tipo text;
  v_point public.registos_ponto%ROWTYPE;
BEGIN
  IF p_funcionario_id IS NULL OR p_loja_id IS NULL
     OR p_tipo NOT IN ('entrada','saida') THEN
    RAISE EXCEPTION 'Invalid time-clock input' USING ERRCODE='22023';
  END IF;

  -- A transaction-scoped lock serializes all clock requests for this employee.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_funcionario_id::text, 741));

  SELECT * INTO v_employee
  FROM public.funcionarios
  WHERE id=p_funcionario_id AND ativo=true AND role='funcionario'
  FOR UPDATE;

  IF NOT FOUND OR v_employee.loja_id IS DISTINCT FROM p_loja_id THEN
    RAISE EXCEPTION 'Active employee/store scope required' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE id=p_loja_id AND ativo=true) THEN
    RAISE EXCEPTION 'Active store required' USING ERRCODE='42501';
  END IF;

  SELECT tipo INTO v_last_tipo
  FROM public.registos_ponto
  WHERE funcionario_id=p_funcionario_id
  ORDER BY timestamp DESC, id DESC
  LIMIT 1;

  IF (p_tipo='entrada' AND v_last_tipo='entrada')
     OR (p_tipo='saida' AND v_last_tipo IS DISTINCT FROM 'entrada') THEN
    RAISE EXCEPTION 'Invalid or duplicate time-clock transition' USING ERRCODE='23505';
  END IF;

  INSERT INTO public.registos_ponto(funcionario_id,loja_id,tipo,timestamp,localizacao)
  VALUES(p_funcionario_id,p_loja_id,p_tipo,clock_timestamp(),p_localizacao)
  RETURNING * INTO v_point;

  RETURN v_point;
END;
$clock$;

REVOKE ALL ON FUNCTION public.register_employee_time_clock(uuid,uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_employee_time_clock(uuid,uuid,text,jsonb)
  TO service_role;
