-- Enforce a single active identity document per client and cover consent audit foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS cliente_documentos_um_documento_ativo_por_cliente_uidx
  ON public.cliente_documentos (cliente_id)
  WHERE substituido_em IS NULL;

CREATE INDEX IF NOT EXISTS whatsapp_aniversarios_consentimentos_funcionario_id_idx
  ON public.whatsapp_aniversarios_consentimentos (funcionario_id);

CREATE INDEX IF NOT EXISTS whatsapp_aniversarios_consentimentos_loja_id_idx
  ON public.whatsapp_aniversarios_consentimentos (loja_id);
