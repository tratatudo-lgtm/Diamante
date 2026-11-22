-- LID pode identificar uma conversa sem expor ainda o número telefónico.
-- Guardamos o JID original e deixamos o telefone por resolver, sem inventar dígitos.
alter table public.whatsapp_conversations
  alter column contact_phone drop not null;
