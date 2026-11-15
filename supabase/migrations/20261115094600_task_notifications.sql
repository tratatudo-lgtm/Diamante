ALTER TABLE public.collab_notifications DROP CONSTRAINT IF EXISTS collab_notifications_kind_check;
ALTER TABLE public.collab_notifications ADD CONSTRAINT collab_notifications_kind_check
  CHECK (kind IN ('report_created','report_updated','report_comment','chat_message','task_assigned','task_updated'));
