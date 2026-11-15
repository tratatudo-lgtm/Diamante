-- Cover remaining collaboration foreign keys used by joins and deletes.
CREATE INDEX IF NOT EXISTS collab_conversations_criada_por_idx ON public.collab_conversations(criada_por);
CREATE INDEX IF NOT EXISTS collab_conversations_loja_idx ON public.collab_conversations(loja_id);
CREATE INDEX IF NOT EXISTS collab_messages_sender_idx ON public.collab_messages(sender_id);
CREATE INDEX IF NOT EXISTS collab_report_comments_employee_idx ON public.collab_report_comments(funcionario_id);
CREATE INDEX IF NOT EXISTS collab_report_events_actor_idx ON public.collab_report_events(actor_id);
CREATE INDEX IF NOT EXISTS collab_reports_assigned_to_idx ON public.collab_reports(assigned_to);
