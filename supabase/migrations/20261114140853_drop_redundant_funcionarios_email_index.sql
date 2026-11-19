-- The UNIQUE constraint already owns a btree index on funcionarios(email).
-- This standalone non-unique index has the same key and no independent dependency.
-- Keep the constraint-backed unique index; remove only the redundant duplicate.
DROP INDEX IF EXISTS public.idx_funcionarios_email;
