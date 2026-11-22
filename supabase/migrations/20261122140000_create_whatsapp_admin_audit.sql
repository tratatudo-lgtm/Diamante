-- Auditoria append-only das intervenções administrativas no WhatsApp.
create table if not exists public.whatsapp_admin_audit (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  admin_id uuid references public.funcionarios(id) on delete set null,
  action text not null check (action in (
    'control_taken', 'control_released', 'admin_message_created',
    'admin_message_sent', 'admin_message_failed', 'admin_message_unknown',
    'conversation_status_changed'
  )),
  outcome text not null default 'success' check (outcome in ('success', 'failed', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_admin_audit_created_idx
  on public.whatsapp_admin_audit (created_at desc);
create index if not exists whatsapp_admin_audit_conversation_idx
  on public.whatsapp_admin_audit (conversation_id, created_at desc);
create index if not exists whatsapp_admin_audit_admin_idx
  on public.whatsapp_admin_audit (admin_id, created_at desc);

alter table public.whatsapp_admin_audit enable row level security;
revoke all on public.whatsapp_admin_audit from anon, authenticated;
grant select, insert on public.whatsapp_admin_audit to service_role;

create or replace function public.prevent_whatsapp_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'whatsapp admin audit is append-only';
end;
$$;

drop trigger if exists whatsapp_admin_audit_no_mutation on public.whatsapp_admin_audit;
create trigger whatsapp_admin_audit_no_mutation
before update or delete on public.whatsapp_admin_audit
for each row execute function public.prevent_whatsapp_admin_audit_mutation();

create or replace function public.audit_whatsapp_admin_conversation_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.mode is distinct from new.mode then
    insert into public.whatsapp_admin_audit (conversation_id, admin_id, action, metadata)
    values (
      new.id,
      new.last_controlled_by,
      case when new.mode = 'human' then 'control_taken' else 'control_released' end,
      jsonb_build_object('previous_mode', old.mode, 'new_mode', new.mode)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_conversation_admin_audit on public.whatsapp_conversations;
create trigger whatsapp_conversation_admin_audit
after update of mode on public.whatsapp_conversations
for each row execute function public.audit_whatsapp_admin_conversation_change();

create or replace function public.audit_whatsapp_admin_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action text;
  v_outcome text;
begin
  if new.sender_type is distinct from 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.whatsapp_admin_audit (conversation_id, admin_id, action, outcome, metadata)
    values (
      new.conversation_id, new.admin_id, 'admin_message_created',
      case when new.status = 'unknown' then 'unknown' when new.status = 'failed' then 'failed' else 'success' end,
      jsonb_build_object('message_id', new.id, 'message_status', new.status)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    v_action := case new.status
      when 'sent' then 'admin_message_sent'
      when 'failed' then 'admin_message_failed'
      when 'unknown' then 'admin_message_unknown'
      else null
    end;
    if v_action is not null then
      v_outcome := case new.status when 'sent' then 'success' when 'failed' then 'failed' else 'unknown' end;
      insert into public.whatsapp_admin_audit (conversation_id, admin_id, action, outcome, metadata)
      values (
        new.conversation_id, new.admin_id, v_action, v_outcome,
        jsonb_build_object('message_id', new.id, 'message_status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists whatsapp_message_admin_audit_insert on public.whatsapp_messages;
create trigger whatsapp_message_admin_audit_insert
after insert on public.whatsapp_messages
for each row execute function public.audit_whatsapp_admin_message();

drop trigger if exists whatsapp_message_admin_audit_update on public.whatsapp_messages;
create trigger whatsapp_message_admin_audit_update
after update of status on public.whatsapp_messages
for each row execute function public.audit_whatsapp_admin_message();


-- O estado é auditado pela rota administrativa para preservar o ID real do operador.
drop trigger if exists whatsapp_conversation_status_audit on public.whatsapp_conversations;
drop function if exists public.audit_whatsapp_admin_status_change();
