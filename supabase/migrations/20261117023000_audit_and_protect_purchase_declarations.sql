-- Auditoria de consulta e proteção contra mutação da evidência após associação à compra.
CREATE TABLE IF NOT EXISTS public.store_purchase_declaration_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid NOT NULL REFERENCES public.transacoes(id) ON DELETE RESTRICT,
  evidence_id uuid NOT NULL REFERENCES public.store_purchase_consent_evidence(id) ON DELETE RESTRICT,
  accessed_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  accessed_role text NOT NULL CHECK (accessed_role IN ('admin', 'funcionario')),
  sha256_verified boolean NOT NULL CHECK (sha256_verified = true),
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_declaration_access_logs_purchase_time
  ON public.store_purchase_declaration_access_logs (transacao_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_declaration_access_logs_actor_time
  ON public.store_purchase_declaration_access_logs (accessed_by, accessed_at DESC);

ALTER TABLE public.store_purchase_declaration_access_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.store_purchase_declaration_access_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.store_purchase_declaration_access_logs TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_mutation_of_linked_purchase_declaration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.transacoes t
    WHERE t.declaracao_assinada_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'A evidência documental associada a uma compra não pode ser alterada ou eliminada'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_of_linked_purchase_declaration
  ON public.store_purchase_consent_evidence;
CREATE TRIGGER trg_prevent_mutation_of_linked_purchase_declaration
  BEFORE UPDATE OR DELETE ON public.store_purchase_consent_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_mutation_of_linked_purchase_declaration();

COMMENT ON TABLE public.store_purchase_declaration_access_logs IS
  'Registo imutável de consultas autorizadas às declarações de compra; escrito apenas pelo backend service_role.';


-- Também proteger o objeto físico no Storage. A proteção dos metadados,
-- isoladamente, não impediria uma remoção/substituição administrativa do blob.
CREATE OR REPLACE FUNCTION public.prevent_mutation_of_linked_declaration_storage_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $function$
BEGIN
  IF OLD.bucket_id = 'declaracoes-compras' AND EXISTS (
    SELECT 1
    FROM public.store_purchase_consent_evidence e
    JOIN public.transacoes t ON t.declaracao_assinada_id = e.id
    WHERE e.storage_path = OLD.name
  ) THEN
    RAISE EXCEPTION 'O ficheiro de uma declaração associada a uma compra não pode ser alterado ou eliminado'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_of_linked_declaration_storage_object
  ON storage.objects;
CREATE TRIGGER trg_prevent_mutation_of_linked_declaration_storage_object
  BEFORE UPDATE OR DELETE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_mutation_of_linked_declaration_storage_object();
