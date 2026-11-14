-- Validade e histórico de documentos de identificação dos clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_emissao_documento date,
  ADD COLUMN IF NOT EXISTS data_validade_documento date;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_documento_validade_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_documento_validade_check
  CHECK (
    data_emissao_documento IS NULL
    OR data_validade_documento IS NULL
    OR data_validade_documento >= data_emissao_documento
  );

CREATE INDEX IF NOT EXISTS idx_clientes_documento_validade
  ON public.clientes (data_validade_documento)
  WHERE data_validade_documento IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cliente_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('cc', 'passaporte', 'cartao_residente', 'outro')),
  numero_documento text NOT NULL CHECK (length(btrim(numero_documento)) > 0),
  data_emissao date,
  data_validade date NOT NULL,
  storage_path text NOT NULL UNIQUE CHECK (length(btrim(storage_path)) > 0),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
  uploaded_by uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  substituido_em timestamptz,
  substituido_por uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  CONSTRAINT cliente_documentos_validade_check
    CHECK (data_emissao IS NULL OR data_validade >= data_emissao)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_documentos_uma_versao_ativa
  ON public.cliente_documentos (cliente_id)
  WHERE substituido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente_historico
  ON public.cliente_documentos (cliente_id, uploaded_at DESC);

ALTER TABLE public.cliente_documentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.cliente_documentos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cliente_documentos TO service_role;

CREATE OR REPLACE VIEW public.v_clientes_documentos_alerta
WITH (security_invoker = true)
AS
SELECT
  c.id AS cliente_id,
  c.nome,
  c.nif,
  c.telemovel,
  c.loja_registo_id,
  c.tipo_documento,
  c.bi_cc AS numero_documento,
  c.data_emissao_documento,
  c.data_validade_documento,
  (c.data_validade_documento - CURRENT_DATE) AS dias_ate_validade,
  CASE
    WHEN c.data_validade_documento < CURRENT_DATE THEN 'expirado'
    WHEN c.data_validade_documento <= CURRENT_DATE + 30 THEN 'a_expirar'
    ELSE 'valido'
  END AS estado_documento
FROM public.clientes AS c
WHERE c.data_validade_documento IS NOT NULL;

REVOKE ALL ON public.v_clientes_documentos_alerta FROM anon, authenticated;
GRANT SELECT ON public.v_clientes_documentos_alerta TO service_role;

COMMENT ON TABLE public.cliente_documentos IS
  'Histórico privado de versões digitalizadas dos documentos de identificação dos clientes. Acesso exclusivo ao backend através de service_role.';
COMMENT ON VIEW public.v_clientes_documentos_alerta IS
  'Fonte de alertas de documentos que expiram nos próximos 30 dias ou já expiraram; acesso exclusivo ao backend.';
