ALTER TABLE public.whatsapp_aniversarios_envios
  DROP CONSTRAINT IF EXISTS whatsapp_aniversarios_envios_estado_check;
ALTER TABLE public.whatsapp_aniversarios_envios
  ADD CONSTRAINT whatsapp_aniversarios_envios_estado_check
  CHECK (estado IN ('pendente', 'em_processamento', 'enviado', 'falhado', 'ignorado'));
