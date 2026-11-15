CREATE INDEX IF NOT EXISTS idx_cliente_documentos_substituido_por
  ON public.cliente_documentos (substituido_por)
  WHERE substituido_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_uploaded_by
  ON public.cliente_documentos (uploaded_by)
  WHERE uploaded_by IS NOT NULL;
