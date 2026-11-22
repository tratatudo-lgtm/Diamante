-- Conversas WhatsApp persistentes, controlo IA/humano e histórico de mensagens.
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  contact_phone text not null,
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  assigned_admin_id uuid references public.funcionarios(id) on delete set null,
  last_controlled_by uuid references public.funcionarios(id) on delete set null,
  last_control_changed_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_instance_jid_unique unique (instance_name, remote_jid)
);

create index if not exists whatsapp_conversations_last_message_idx
  on public.whatsapp_conversations (last_message_at desc);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  external_message_id text,
  client_message_id uuid,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'ai', 'admin')),
  body text not null,
  status text not null default 'received' check (status in ('received', 'sending', 'sent', 'failed', 'unknown')),
  admin_id uuid references public.funcionarios(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

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
