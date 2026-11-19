-- Documentos de identificação só podem ser acedidos pelo backend autenticado.
-- A política antiga permitia a qualquer utilizador autenticado gerir todo o bucket.
DROP POLICY IF EXISTS "Staff pode gerir documentos" ON storage.objects;

-- Permitir rollback controlado de uploads/documentos falhados pelo backend.
GRANT DELETE ON TABLE public.cliente_documentos TO service_role;

COMMENT ON TABLE public.cliente_documentos IS
  'Histórico privado de documentos de identificação; operações apenas pelo backend com service_role.';
