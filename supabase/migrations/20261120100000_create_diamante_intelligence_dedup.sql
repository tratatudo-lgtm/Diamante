-- Deduplicação durável de eventos WhatsApp recebidos pela Evolution API.
create table if not exists public.diamante_intelligence_webhook_events (
  id bigint generated always as identity primary key,
  instance_name text not null,
  message_id text not null,
  received_at timestamptz not null default now(),
  constraint diamante_intelligence_webhook_events_unique unique (instance_name, message_id)
);

alter table public.diamante_intelligence_webhook_events enable row level security;
revoke all on table public.diamante_intelligence_webhook_events from anon, authenticated;
grant select, insert on table public.diamante_intelligence_webhook_events to service_role;

create index if not exists diamante_intelligence_webhook_events_received_at_idx
  on public.diamante_intelligence_webhook_events (received_at);
