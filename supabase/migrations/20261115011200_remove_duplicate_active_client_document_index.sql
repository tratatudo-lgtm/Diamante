-- Keep the original active-document unique index; remove the duplicate added during hardening.
DROP INDEX IF EXISTS public.cliente_documentos_um_documento_ativo_por_cliente_uidx;
