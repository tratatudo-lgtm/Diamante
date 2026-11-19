CREATE OR REPLACE FUNCTION public.claim_birthday_whatsapp_messages(
  p_today date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Lisbon')::date
)
RETURNS TABLE (cliente_id uuid, nome text, telemovel text, ano integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  -- Consentimento retirado, aniversário alterado ou contacto inválido:
  -- não deixar mensagens pendentes elegíveis para envio.
  UPDATE public.whatsapp_aniversarios_envios AS e
  SET estado = 'ignorado',
      erro = 'Cliente sem consentimento activo, aniversário alterado ou telefone inválido.',
      atualizado_em = now()
  FROM public.clientes AS c
  WHERE c.id = e.cliente_id
    AND e.ano = EXTRACT(YEAR FROM p_today)::integer
    AND e.estado IN ('pendente', 'falhado')
    AND (
      c.consentimento_whatsapp_aniversario IS DISTINCT FROM true
      OR c.data_nascimento IS NULL
      OR EXTRACT(MONTH FROM c.data_nascimento) <> EXTRACT(MONTH FROM p_today)
      OR EXTRACT(DAY FROM c.data_nascimento) <> EXTRACT(DAY FROM p_today)
      OR c.telemovel !~ '^[+][1-9][0-9]{7,14}$'
    );

  INSERT INTO public.whatsapp_aniversarios_envios (cliente_id, ano, estado)
  SELECT c.id, EXTRACT(YEAR FROM p_today)::integer, 'pendente'
  FROM public.clientes AS c
  WHERE c.data_nascimento IS NOT NULL
    AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM p_today)
    AND c.consentimento_whatsapp_aniversario = true
    AND c.telemovel ~ '^[+][1-9][0-9]{7,14}$'
  ON CONFLICT (cliente_id, ano) DO NOTHING;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.id
    FROM public.whatsapp_aniversarios_envios AS e
    JOIN public.clientes AS c ON c.id = e.cliente_id
    WHERE e.ano = EXTRACT(YEAR FROM p_today)::integer
      AND c.consentimento_whatsapp_aniversario = true
      AND c.data_nascimento IS NOT NULL
      AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM p_today)
      AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM p_today)
      AND c.telemovel ~ '^[+][1-9][0-9]{7,14}$'
      AND e.tentativas < 3
      AND (
        e.estado = 'pendente'
        OR (e.estado = 'falhado' AND e.atualizado_em < now() - interval '10 minutes')
        OR (e.estado = 'em_processamento' AND e.atualizado_em < now() - interval '15 minutes')
      )
    ORDER BY e.criado_em
    FOR UPDATE OF e SKIP LOCKED
    LIMIT 500
  ),
  claimed AS (
    UPDATE public.whatsapp_aniversarios_envios AS e
    SET estado = 'em_processamento',
        tentativas = e.tentativas + 1,
        atualizado_em = now(),
        erro = NULL
    FROM candidates AS c
    WHERE e.id = c.id
    RETURNING e.cliente_id, e.ano
  )
  SELECT cl.id, cl.nome, cl.telemovel, claimed.ano
  FROM claimed
  JOIN public.clientes AS cl ON cl.id = claimed.cliente_id
  WHERE cl.consentimento_whatsapp_aniversario = true
    AND cl.data_nascimento IS NOT NULL
    AND EXTRACT(MONTH FROM cl.data_nascimento) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY FROM cl.data_nascimento) = EXTRACT(DAY FROM p_today)
    AND cl.telemovel ~ '^[+][1-9][0-9]{7,14}$';
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_birthday_whatsapp_messages(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_birthday_whatsapp_messages(date) TO service_role;
