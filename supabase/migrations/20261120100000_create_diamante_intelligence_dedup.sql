-- Deduplicação durável e auditoria técnica mínima dos eventos WhatsApp.
create table if not exists public.diamante_intelligence_webhook_events (
  id bigint generated always as identity primary key,
  instance_name text not null,
  message_id text not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint diamante_intelligence_webhook_events_unique unique (instance_name, message_id)
);

alter table public.diamante_intelligence_webhook_events enable row level security;
revoke all on table public.diamante_intelligence_webhook_events from anon, authenticated;
grant select, insert, update on table public.diamante_intelligence_webhook_events to service_role;

create index if not exists diamante_intelligence_webhook_events_received_at_idx
  on public.diamante_intelligence_webhook_events (received_at);
