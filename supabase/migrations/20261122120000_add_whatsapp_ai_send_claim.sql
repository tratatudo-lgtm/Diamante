-- Serializa o envio automático do Diamante com a tomada de controlo humana.
alter table public.whatsapp_conversations
  add column if not exists ai_send_token uuid,
  add column if not exists ai_send_started_at timestamptz;

create index if not exists whatsapp_conversations_ai_send_started_idx
  on public.whatsapp_conversations (ai_send_started_at)
  where ai_send_token is not null;

comment on column public.whatsapp_conversations.ai_send_token is
  'Identificador do evento webhook que reservou temporariamente o envio automático.';
comment on column public.whatsapp_conversations.ai_send_started_at is
  'Início da reserva; após 60 segundos pode ser recuperada, sem repetir o evento.';
