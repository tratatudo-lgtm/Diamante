-- Schema draft; validate and generate a migration before deployment.
create table public.qualidades_metal (
 id uuid primary key default gen_random_uuid(),
 metal text not null,
 nome text not null,
 toque integer not null check (toque between 1 and 1000),
 ativo boolean not null default true,
 unique(metal,toque)
);
create table public.publicacoes_precos (
 id uuid primary key default gen_random_uuid(),
 administrador_id uuid not null references public.funcionarios(id),
 publicado_em timestamptz not null default now()
);
create table public.publicacoes_precos_itens (
 publicacao_id uuid not null references public.publicacoes_precos(id),
 qualidade_id uuid not null references public.qualidades_metal(id),
 centimos_por_grama integer not null check (centimos_por_grama between 1 and 10000000),
 primary key(publicacao_id,qualidade_id)
);
create table public.cotacoes_clientes (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id),
 funcionario_id uuid not null references public.funcionarios(id),
 cliente_id uuid not null references public.clientes(id),
 publicacao_id uuid not null references public.publicacoes_precos(id),
 estado text not null default 'rascunho' check (estado in ('rascunho','apresentada','aceite','recusada','expirada','convertida')),
 criado_em timestamptz not null default now(),
 expira_em timestamptz not null,
 transacao_id uuid unique references public.transacoes(id),
 unique(id,publicacao_id),
 check ((estado='convertida') = (transacao_id is not null))
);
create table public.cotacoes_clientes_pecas (
 id uuid primary key default gen_random_uuid(),
 cotacao_id uuid not null,
 publicacao_id uuid not null,
 qualidade_id uuid not null,
 tipo_peca text not null check (length(trim(tipo_peca)) between 1 and 100),
 descricao text not null default '',
 peso_miligramas integer not null check (peso_miligramas between 1 and 10000000),
 foreign key(cotacao_id,publicacao_id) references public.cotacoes_clientes(id,publicacao_id),
 foreign key(publicacao_id,qualidade_id) references public.publicacoes_precos_itens(publicacao_id,qualidade_id)
);
create index on public.cotacoes_clientes(loja_id,criado_em desc);
create index on public.cotacoes_clientes_pecas(cotacao_id);
alter table public.qualidades_metal enable row level security;
alter table public.publicacoes_precos enable row level security;
alter table public.publicacoes_precos_itens enable row level security;
alter table public.cotacoes_clientes enable row level security;
alter table public.cotacoes_clientes_pecas enable row level security;
revoke all on public.qualidades_metal,public.publicacoes_precos,public.publicacoes_precos_itens,public.cotacoes_clientes,public.cotacoes_clientes_pecas from public,anon,authenticated;
grant select,insert,update on public.qualidades_metal,public.cotacoes_clientes,public.cotacoes_clientes_pecas to service_role;
grant select,insert on public.publicacoes_precos,public.publicacoes_precos_itens to service_role;
-- Publication and quotation creation must be atomic through server-side RPCs.
-- Verify administrator role and store scope using existing authenticated backend.
-- Conversion must lock the quote, verify state and expiry, and atomically create
-- transaction, inventory lines and financial records using existing approval rules.
