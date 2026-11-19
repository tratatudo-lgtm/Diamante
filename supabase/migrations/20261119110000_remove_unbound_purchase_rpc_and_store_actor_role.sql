-- Keep only the declaration-bound purchase RPC and align evidence metadata with the API.
-- The older quote-only overload has no declaration parameter and must not remain callable.
DROP FUNCTION IF EXISTS public.create_store_purchase(
 uuid, uuid, uuid, text, text, text, text, text,
 numeric, numeric, numeric, numeric, numeric, text,
 text, text, text, timestamptz
);

-- The upload API records the actor role; persist it rather than relying on a
-- frontend-only field. Existing evidence is backfilled from its owning employee.
ALTER TABLE public.store_purchase_consent_evidence
 ADD COLUMN IF NOT EXISTS actor_role text;

UPDATE public.store_purchase_consent_evidence e
SET actor_role = f.role
FROM public.funcionarios f
WHERE f.id = e.funcionario_id
  AND e.actor_role IS NULL;

DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.store_purchase_consent_evidence
   WHERE actor_role IS NULL OR actor_role NOT IN ('admin','funcionario')
 ) THEN
   RAISE EXCEPTION 'Não foi possível reconciliar o perfil de todas as declarações existentes';
 END IF;
END $$;

ALTER TABLE public.store_purchase_consent_evidence
 ALTER COLUMN actor_role SET NOT NULL;

DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.store_purchase_consent_evidence'::regclass
     AND conname='store_purchase_consent_evidence_actor_role_check'
 ) THEN
   ALTER TABLE public.store_purchase_consent_evidence
    ADD CONSTRAINT store_purchase_consent_evidence_actor_role_check
    CHECK (actor_role IN ('admin','funcionario'));
 END IF;
END $$;
