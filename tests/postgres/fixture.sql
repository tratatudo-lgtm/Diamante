DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.lojas (
  id uuid PRIMARY KEY,
  nome text NOT NULL
);

CREATE TABLE public.funcionarios (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  role text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT true $$;

CREATE TABLE public.transacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia text NOT NULL,
  loja_id uuid REFERENCES public.lojas(id),
  loja_nome text,
  beneficiario_nome text,
  beneficiario_nif text,
  beneficiario_iban text,
  valor numeric(14,2) NOT NULL,
  metodo text,
  conta_origem text,
  descricao text,
  peso_ouro_gramas numeric(12,3),
  tipo_metal text,
  operador_nome text,
  comprovativo_ref text,
  data date,
  hora text,
  estado text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lojas(id,nome) VALUES
('11111111-1111-4111-8111-111111111111','Loja teste');

INSERT INTO public.funcionarios(id,nome,role,ativo) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Admin activo','admin',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Segundo admin','admin',true),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Admin inactivo','admin',false),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Funcionário','funcionario',true);

-- Legacy payment exists before the audit migration.
INSERT INTO public.transacoes_financeiras(
  id,referencia,loja_id,loja_nome,beneficiario_nome,valor,metodo,descricao,estado,created_at
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','LEGACY-001',
  '11111111-1111-4111-8111-111111111111','Loja teste','Fornecedor legado',
  25.50,'transferencia','Pagamento anterior à auditoria','pago','2026-10-05T10:00:00Z'
);
