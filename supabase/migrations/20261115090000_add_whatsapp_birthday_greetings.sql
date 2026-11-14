-- Birthday greetings are independent from document-expiry alerts.
-- Explicit opt-in is required; legacy customers remain opted out.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS consentimento_whatsapp_aniversario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_whatsapp_aniversario_data timestamptz;

COMMENT ON COLUMN public.clientes.consentimento_whatsapp_aniversario IS
  'Consentimento explícito do cliente para receber uma mensagem de aniversário por WhatsApp.';
COMMENT ON COLUMN public.clientes.consentimento_whatsapp_aniversario_data IS
  'Data/hora em que foi registado ou retirado o consentimento de mensagens de aniversário por WhatsApp.';

CREATE TABLE IF NOT EXISTS public.whatsapp_aniversarios_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 2200),
  estado text NOT NULL DEFAULT 'pendente'
    CHECK (estado IN ('pendente', 'em_processamento', 'enviado', 'falhado')),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  message_id text,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  UNIQUE (cliente_id, ano)
);

CREATE INDEX IF NOT EXISTS whatsapp_aniversarios_pendentes_idx
  ON public.whatsapp_aniversarios_envios (estado, atualizado_em);

ALTER TABLE public.whatsapp_aniversarios_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_aniversarios_envios FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.whatsapp_aniversarios_envios TO service_role;

CREATE OR REPLACE FUNCTION public.claim_birthday_whatsapp_messages(
  p_today date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Lisbon')::date
)
RETURNS TABLE (cliente_id uuid, nome text, telemovel text, ano integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.whatsapp_aniversarios_envios (cliente_id, ano, estado)
  SELECT c.id, EXTRACT(YEAR FROM p_today)::integer, 'pendente'
  FROM public.clientes AS c
  WHERE c.data_nascimento IS NOT NULL
    AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM p_today)
    AND c.consentimento_whatsapp_aniversario = true
    AND c.telemovel ~ '^\\+[1-9][0-9]{7,14}$'
  ON CONFLICT (cliente_id, ano) DO NOTHING;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.id
    FROM public.whatsapp_aniversarios_envios AS e
    WHERE e.ano = EXTRACT(YEAR FROM p_today)::integer
      AND (
        (e.estado = 'pendente' AND e.tentativas < 3)
        OR (e.estado = 'falhado' AND e.tentativas < 3 AND e.atualizado_em < now() - interval '10 minutes')
      )
    ORDER BY e.criado_em
    FOR UPDATE SKIP LOCKED
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
    AND cl.telemovel ~ '^\\+[1-9][0-9]{7,14}$';
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_birthday_whatsapp_messages(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_birthday_whatsapp_messages(date) TO service_role;
