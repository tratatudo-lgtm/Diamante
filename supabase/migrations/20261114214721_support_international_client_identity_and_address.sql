ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'cc',
  ADD COLUMN IF NOT EXISTS codigo_postal text,
  ADD COLUMN IF NOT EXISTS pais_residencia text;

ALTER TABLE public.clientes
  ALTER COLUMN morada DROP NOT NULL;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_tipo_documento_check,
  ADD CONSTRAINT clientes_tipo_documento_check
    CHECK (tipo_documento IN ('cc', 'passaporte', 'cartao_residente', 'outro'));

COMMENT ON COLUMN public.clientes.tipo_documento IS 'Tipo do documento de identificação apresentado pelo cliente.';
COMMENT ON COLUMN public.clientes.codigo_postal IS 'Código postal opcional, conforme o país de residência.';
COMMENT ON COLUMN public.clientes.pais_residencia IS 'Código ISO 3166-1 alpha-2 do país de residência, quando conhecido.';
