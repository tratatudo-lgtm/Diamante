-- Persist WhatsApp OTP challenges and request limits across server restarts
-- and multiple application instances. Only SECURITY DEFINER RPCs may access rows.

CREATE TABLE IF NOT EXISTS public.whatsapp_otp_challenges (
  phone_hash text PRIMARY KEY CHECK (phone_hash ~ '^[a-f0-9]{64}$'),
  employee_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  request_window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count smallint NOT NULL DEFAULT 1 CHECK (request_count BETWEEN 1 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.whatsapp_otp_challenges FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_whatsapp_otp_challenge(
  p_phone_hash text,
  p_employee_id uuid,
  p_code_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE(status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_request_count smallint;
BEGIN
  IF p_phone_hash IS NULL OR p_phone_hash !~ '^[a-f0-9]{64}$'
    OR p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$'
    OR p_employee_id IS NULL
    OR p_expires_at IS NULL
    OR p_expires_at <= now()
    OR p_expires_at > now() + interval '6 minutes'
  THEN
    RETURN QUERY SELECT 'invalid'::text;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = p_employee_id AND ativo = true
  ) THEN
    RETURN QUERY SELECT 'unauthorized'::text;
    RETURN;
  END IF;

  INSERT INTO public.whatsapp_otp_challenges AS current_challenge (
    phone_hash, employee_id, code_hash, expires_at, attempts,
    request_window_started_at, request_count, consumed_at, created_at, updated_at
  ) VALUES (
    p_phone_hash, p_employee_id, p_code_hash, p_expires_at, 0,
    now(), 1, NULL, now(), now()
  )
  ON CONFLICT (phone_hash) DO UPDATE SET
    employee_id = EXCLUDED.employee_id,
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    request_window_started_at = CASE
      WHEN current_challenge.request_window_started_at <= now() - interval '15 minutes'
      THEN now()
      ELSE current_challenge.request_window_started_at
    END,
    request_count = CASE
      WHEN current_challenge.request_window_started_at <= now() - interval '15 minutes'
      THEN 1
      ELSE current_challenge.request_count + 1
    END,
    consumed_at = NULL,
    updated_at = now()
  WHERE current_challenge.request_window_started_at <= now() - interval '15 minutes'
     OR current_challenge.request_count < 5
  RETURNING current_challenge.request_count INTO v_request_count;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'rate_limited'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'created'::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_whatsapp_otp_challenge(
  p_phone_hash text,
  p_code_hash text
)
RETURNS TABLE(status text, employee_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_challenge public.whatsapp_otp_challenges%ROWTYPE;
  v_attempts smallint;
BEGIN
  IF p_phone_hash IS NULL OR p_phone_hash !~ '^[a-f0-9]{64}$'
    OR p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT * INTO v_challenge
  FROM public.whatsapp_otp_challenges
  WHERE phone_hash = p_phone_hash
  FOR UPDATE;

  IF NOT FOUND OR v_challenge.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_challenge.expires_at <= now() THEN
    UPDATE public.whatsapp_otp_challenges
    SET consumed_at = now(), updated_at = now()
    WHERE phone_hash = p_phone_hash;
    RETURN QUERY SELECT 'expired'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_challenge.attempts >= 3 THEN
    UPDATE public.whatsapp_otp_challenges
    SET consumed_at = now(), updated_at = now()
    WHERE phone_hash = p_phone_hash;
    RETURN QUERY SELECT 'locked'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_challenge.code_hash <> p_code_hash THEN
    v_attempts := v_challenge.attempts + 1;
    UPDATE public.whatsapp_otp_challenges
    SET attempts = v_attempts,
        consumed_at = CASE WHEN v_attempts >= 3 THEN now() ELSE consumed_at END,
        updated_at = now()
    WHERE phone_hash = p_phone_hash;

    IF v_attempts >= 3 THEN
      RETURN QUERY SELECT 'locked'::text, NULL::uuid;
    ELSE
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid;
    END IF;
    RETURN;
  END IF;

  UPDATE public.whatsapp_otp_challenges
  SET consumed_at = now(), updated_at = now()
  WHERE phone_hash = p_phone_hash;

  RETURN QUERY SELECT 'valid'::text, v_challenge.employee_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_whatsapp_otp_challenge(p_phone_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  UPDATE public.whatsapp_otp_challenges
  SET consumed_at = COALESCE(consumed_at, now()), updated_at = now()
  WHERE phone_hash = p_phone_hash;
$function$;

REVOKE ALL ON FUNCTION public.create_whatsapp_otp_challenge(text, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_whatsapp_otp_challenge(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_whatsapp_otp_challenge(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_whatsapp_otp_challenge(text, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_whatsapp_otp_challenge(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_whatsapp_otp_challenge(text) TO service_role;

COMMENT ON TABLE public.whatsapp_otp_challenges IS
  'Desafios OTP de autenticação WhatsApp persistentes; os hashes são HMAC e as linhas só são operadas por RPCs do backend.';
