CREATE INDEX IF NOT EXISTS collab_report_attachments_uploaded_by_idx
  ON public.collab_report_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS operational_goal_events_actor_idx
  ON public.operational_goal_events(actor_id);
CREATE INDEX IF NOT EXISTS operational_goals_created_by_idx
  ON public.operational_goals(created_by);
CREATE INDEX IF NOT EXISTS operational_task_events_actor_idx
  ON public.operational_task_events(actor_id);
