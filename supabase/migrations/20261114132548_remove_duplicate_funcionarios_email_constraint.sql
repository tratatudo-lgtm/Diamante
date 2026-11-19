-- Remove the duplicate UNIQUE constraint on funcionarios.email.
-- funcionarios_email_key remains and continues enforcing email uniqueness.
ALTER TABLE public.funcionarios
  DROP CONSTRAINT IF EXISTS uq_funcionarios_email;
