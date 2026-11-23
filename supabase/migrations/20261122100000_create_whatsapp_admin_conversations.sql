-- Conversas WhatsApp persistentes, controlo IA/humano e histórico de mensagens.
-- Compatível com instalações novas e com a tabela whatsapp_messages legada.
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  contact_phone text,
  client_id uuid,
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  status text not null default 'unread' check (status in ('unread', 'in_service', 'pending', 'resolved')),
  assigned_admin_id uuid references public.funcionarios(id) on delete set null,
  last_controlled_by uuid references public.funcionarios(id) on delete set null,
  last_control_changed_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_instance_jid_unique unique (instance_name, remote_jid)
);

do $
begin
  if to_regclass('public.clientes') is not null
     and not exists (select 1 from pg_constraint where conname = 'whatsapp_conversations_client_id_fkey' and conrelid = 'public.whatsapp_conversations'::regclass) then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_client_id_fkey
      foreign key (client_id) references public.clientes(id) on delete set null;
  end if;
end;
$;

alter table public.whatsapp_conversations add column if not exists client_id uuid;

create index if not exists whatsapp_conversations_client_id_idx
  on public.whatsapp_conversations (client_id) where client_id is not null;

create index if not exists whatsapp_conversations_last_message_idx
  on public.whatsapp_conversations (last_message_at desc);

-- Em bases antigas esta tabela já existe com instance_name/sender_number/
-- message_type/content/timestamp/processed. Não a substituir nem apagar.
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
  external_message_id text,
  client_message_id uuid,
  direction text check (direction in ('inbound', 'outbound')),
  sender_type text check (sender_type in ('customer', 'ai', 'admin')),
  body text not null,
  status text not null default 'received' check (status in ('received', 'sending', 'sent', 'failed', 'unknown')),
  admin_id uuid references public.funcionarios(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.whatsapp_messages
  add column if not exists conversation_id uuid references public.whatsapp_conversations(id) on delete cascade,
  add column if not exists external_message_id text,
  add column if not exists client_message_id uuid,
  add column if not exists direction text,
  add column if not exists sender_type text,
  add column if not exists body text,
  add column if not exists status text default 'received',
  add column if not exists admin_id uuid references public.funcionarios(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists sent_at timestamptz;

-- Colunas antigas continuam disponíveis para integrações históricas, mas deixam
-- de ser obrigatórias para os novos registos do painel/webhook.
do $legacy$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'whatsapp_messages' and column_name = 'instance_name') then
    alter table public.whatsapp_messages alter column instance_name drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'whatsapp_messages' and column_name = 'sender_number') then
    alter table public.whatsapp_messages alter column sender_number drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'whatsapp_messages' and column_name = 'message_type') then
    alter table public.whatsapp_messages alter column message_type drop not null;
  end if;
end;
$legacy$;

-- Migrar o conteúdo antigo sem inventar direção ou autoria para mensagens históricas.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_messages' and column_name = 'content'
  ) then
    execute 'update public.whatsapp_messages set body = coalesce(body, content, '''') where body is null';
  else
    update public.whatsapp_messages set body = '' where body is null;
  end if;
end;
$$;

alter table public.whatsapp_messages
  alter column body set not null,
  alter column status set default 'received',
  alter column status set not null,
  alter column created_at set default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_messages_direction_check' and conrelid = 'public.whatsapp_messages'::regclass) then
    alter table public.whatsapp_messages add constraint whatsapp_messages_direction_check check (direction in ('inbound', 'outbound'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_messages_sender_type_check' and conrelid = 'public.whatsapp_messages'::regclass) then
    alter table public.whatsapp_messages add constraint whatsapp_messages_sender_type_check check (sender_type in ('customer', 'ai', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_messages_status_check' and conrelid = 'public.whatsapp_messages'::regclass) then
    alter table public.whatsapp_messages add constraint whatsapp_messages_status_check check (status in ('received', 'sending', 'sent', 'failed', 'unknown'));
  end if;
end;
$$;

create unique index if not exists whatsapp_messages_external_id_unique
  on public.whatsapp_messages (conversation_id, external_message_id)
  where external_message_id is not null;

create unique index if not exists whatsapp_messages_client_id_unique
  on public.whatsapp_messages (conversation_id, client_message_id)
  where client_message_id is not null;

create index if not exists whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages (conversation_id, created_at);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
revoke all on public.whatsapp_conversations, public.whatsapp_messages from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_conversations, public.whatsapp_messages to service_role;
