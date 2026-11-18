\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.lojas (
  id uuid PRIMARY KEY, nome text NOT NULL, ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE public.funcionarios (
  id uuid PRIMARY KEY, nome_completo text NOT NULL, role text NOT NULL,
  ativo boolean NOT NULL DEFAULT true, loja_id uuid REFERENCES public.lojas(id)
);
INSERT INTO public.lojas(id,nome) VALUES ('11111111-1111-4111-8111-111111111111','Loja teste');
INSERT INTO public.funcionarios(id,nome_completo,role,loja_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Admin A','admin','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Admin B','admin','11111111-1111-4111-8111-111111111111'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Funcionário','funcionario','11111111-1111-4111-8111-111111111111');

CREATE TABLE public.operational_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'por_fazer', priority text NOT NULL DEFAULT 'normal',
 assigned_to uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL, due_at timestamptz,
 completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operational_task_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.operational_tasks(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 action text NOT NULL, old_values jsonb, new_values jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operational_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '',
 scope text NOT NULL, metric text NOT NULL, target_value numeric NOT NULL,
 loja_id uuid REFERENCES public.lojas(id) ON DELETE RESTRICT,
 funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 starts_on date NOT NULL, ends_on date NOT NULL, status text NOT NULL DEFAULT 'activa',
 created_by uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operational_goal_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), goal_id uuid NOT NULL REFERENCES public.operational_goals(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 action text NOT NULL, old_values jsonb, new_values jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.collab_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text GENERATED ALWAYS AS ('DD-' || upper(substr(replace(id::text, '-', ''), 1, 8))) STORED,
 titulo text NOT NULL, descricao text NOT NULL, categoria text NOT NULL,
 prioridade text NOT NULL DEFAULT 'normal', estado text NOT NULL DEFAULT 'novo',
 reporter_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
 assigned_to uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE public.collab_report_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES public.collab_reports(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 action text NOT NULL, old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
 new_values jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.funcionarios(id,nome_completo,role,ativo,loja_id) VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Funcionário inactivo','funcionario',false,'11111111-1111-4111-8111-111111111111');
CREATE TABLE public.collab_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo text NOT NULL CHECK(tipo IN ('directa','grupo')),
 titulo text, criada_por uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 last_message_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT collab_group_title_required CHECK(tipo<>'grupo' OR (titulo IS NOT NULL AND length(trim(titulo)) BETWEEN 2 AND 100))
);
CREATE TABLE public.collab_conversation_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.collab_conversations(id) ON DELETE CASCADE,
 funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
 papel text NOT NULL DEFAULT 'membro' CHECK(papel IN ('criador','membro')),
 joined_at timestamptz NOT NULL DEFAULT now(), last_read_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conversation_id,funcionario_id)
);
CREATE TABLE public.collab_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.collab_conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz, deleted_at timestamptz
);

\ir ../../supabase/migrations/20261118203000_atomic_collaboration_messaging.sql
\ir ../../supabase/migrations/20261118174500_atomic_operational_creation_audit.sql
\ir ../../supabase/migrations/20261118190000_atomic_operational_updates_audit.sql

DO $audit$
BEGIN
 IF has_function_privilege('authenticated','public.create_operational_task_with_event(text,text,uuid,uuid,uuid,text,timestamptz)','EXECUTE')
 OR has_function_privilege('authenticated','public.create_operational_goal_with_event(text,text,text,text,numeric,uuid,uuid,date,date,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.create_collab_report_with_event(text,text,text,text,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'authenticated não pode executar as RPCs SECURITY DEFINER';
 END IF;
 IF NOT has_function_privilege('service_role','public.create_operational_task_with_event(text,text,uuid,uuid,uuid,text,timestamptz)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.create_operational_goal_with_event(text,text,text,text,numeric,uuid,uuid,date,date,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.create_collab_report_with_event(text,text,text,text,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'service_role não tem EXECUTE nas RPCs operacionais';
 END IF;
END $audit$;

CREATE FUNCTION public.reject_test_audit_for_admin_b()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid THEN
   RAISE EXCEPTION 'injected_audit_failure' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fail_task_audit BEFORE INSERT ON public.operational_task_events
 FOR EACH ROW EXECUTE FUNCTION public.reject_test_audit_for_admin_b();
CREATE TRIGGER fail_goal_audit BEFORE INSERT ON public.operational_goal_events
 FOR EACH ROW EXECUTE FUNCTION public.reject_test_audit_for_admin_b();
CREATE TRIGGER fail_report_audit BEFORE INSERT ON public.collab_report_events
 FOR EACH ROW EXECUTE FUNCTION public.reject_test_audit_for_admin_b();

DO $$
DECLARE v jsonb; n integer; failed boolean;
BEGIN
 v:=public.create_operational_task_with_event('Tarefa válida','Teste atómico',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','normal',NULL);
 IF v->>'id' IS NULL THEN RAISE EXCEPTION 'RPC tarefa não devolveu ID'; END IF;
 SELECT count(*) INTO n FROM public.operational_task_events WHERE task_id=(v->>'id')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'Tarefa criada sem exactamente um evento'; END IF;

 failed:=false;
 BEGIN
  PERFORM public.create_operational_task_with_event('Tarefa falhada','Teste rollback',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '11111111-1111-4111-8111-111111111111','normal',NULL);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha injectada de auditoria não ocorreu na tarefa'; END IF;
 SELECT count(*) INTO n FROM public.operational_tasks WHERE created_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 IF n<>0 THEN RAISE EXCEPTION 'Tarefa parcial persistiu após falha de auditoria'; END IF;

 v:=public.create_operational_goal_with_event('Objectivo válido','Teste atómico','loja',
  'transacoes_aprovadas',10,'11111111-1111-4111-8111-111111111111',NULL,
  '2026-11-01','2026-11-30','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 SELECT count(*) INTO n FROM public.operational_goal_events WHERE goal_id=(v->>'id')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'Objectivo criado sem exactamente um evento'; END IF;

 failed:=false;
 BEGIN
  PERFORM public.create_operational_goal_with_event('Objectivo falhado','Teste rollback','loja',
   'transacoes_aprovadas',10,'11111111-1111-4111-8111-111111111111',NULL,
   '2026-11-01','2026-11-30','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha injectada de auditoria não ocorreu no objectivo'; END IF;
 SELECT count(*) INTO n FROM public.operational_goals WHERE created_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 IF n<>0 THEN RAISE EXCEPTION 'Objectivo parcial persistiu após falha de auditoria'; END IF;

 v:=public.create_collab_report_with_event('Ocorrência válida','Descrição de teste atómico',
  'sistema','normal','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 SELECT count(*) INTO n FROM public.collab_report_events WHERE report_id=(v->>'id')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'Ocorrência criada sem exactamente um evento'; END IF;

 failed:=false;
 BEGIN
  PERFORM public.create_collab_report_with_event('Ocorrência falhada','Descrição de teste rollback',
   'sistema','normal','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha injectada de auditoria não ocorreu na ocorrência'; END IF;
 SELECT count(*) INTO n FROM public.collab_reports WHERE reporter_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 IF n<>0 THEN RAISE EXCEPTION 'Ocorrência parcial persistiu após falha de auditoria'; END IF;
END $$;


-- Atomic task update and audit; injected event failures must roll back the row update.
DO $$
DECLARE v jsonb; v_id uuid; v_stamp timestamptz; n integer; failed boolean;
BEGIN
 v:=public.create_operational_task_with_event('Tarefa update','Antes',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','normal',NULL);
 v_id:=(v->>'id')::uuid;
 v_stamp:=(v->>'updated_at')::timestamptz;
 v:=public.update_operational_task_with_event(v_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v_stamp,
  '{"title":"Tarefa actualizada"}'::jsonb);
 IF v->>'title'<>'Tarefa actualizada' THEN RAISE EXCEPTION 'Actualização atómica da tarefa falhou'; END IF;
 SELECT count(*) INTO n FROM public.operational_task_events WHERE task_id=v_id;
 IF n<>2 THEN RAISE EXCEPTION 'Histórico da tarefa não contém criação e actualização'; END IF;

 v_stamp:=(v->>'updated_at')::timestamptz;
 failed:=false;
 BEGIN
  PERFORM public.update_operational_task_with_event(v_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_stamp,
   '{"title":"Não deve persistir"}'::jsonb);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha de auditoria da actualização da tarefa não foi injectada'; END IF;
 SELECT count(*) INTO n FROM public.operational_tasks WHERE id=v_id AND title='Tarefa actualizada';
 IF n<>1 THEN RAISE EXCEPTION 'Actualização parcial da tarefa persistiu após falha de auditoria'; END IF;

 failed:=false;
 BEGIN
  PERFORM public.update_operational_task_with_event(v_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '2000-01-01'::timestamptz,'{"title":"Conflito"}'::jsonb);
 EXCEPTION WHEN SQLSTATE '40001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Actualização stale de tarefa não foi bloqueada'; END IF;
END $$;

-- Atomic goal update and audit.
DO $$
DECLARE v jsonb; v_id uuid; v_stamp timestamptz; n integer; failed boolean;
BEGIN
 v:=public.create_operational_goal_with_event('Objectivo update','Antes','loja',
  'transacoes_aprovadas',10,'11111111-1111-4111-8111-111111111111',NULL,
  '2026-11-01','2026-11-30','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 v_id:=(v->>'id')::uuid;
 v_stamp:=(v->>'updated_at')::timestamptz;
 v:=public.update_operational_goal_with_event(v_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v_stamp,
  '{"title":"Objectivo actualizado","target_value":20}'::jsonb);
 IF v->>'title'<>'Objectivo actualizado' OR (v->>'target_value')::numeric<>20
 THEN RAISE EXCEPTION 'Actualização atómica do objectivo falhou'; END IF;
 SELECT count(*) INTO n FROM public.operational_goal_events WHERE goal_id=v_id;
 IF n<>2 THEN RAISE EXCEPTION 'Histórico do objectivo não contém criação e actualização'; END IF;

 v_stamp:=(v->>'updated_at')::timestamptz;
 failed:=false;
 BEGIN
  PERFORM public.update_operational_goal_with_event(v_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_stamp,
   '{"title":"Não deve persistir"}'::jsonb);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha de auditoria da actualização do objectivo não foi injectada'; END IF;
 SELECT count(*) INTO n FROM public.operational_goals WHERE id=v_id AND title='Objectivo actualizado';
 IF n<>1 THEN RAISE EXCEPTION 'Actualização parcial do objectivo persistiu após falha de auditoria'; END IF;
END $$;

SELECT 'POSTGRES_OPERATIONAL_ATOMICITY_OK' AS result;

-- Atomic employee conversation creation and message activity.
CREATE FUNCTION public.reject_test_membership_for_employee()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.funcionario_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid THEN
   RAISE EXCEPTION 'injected_membership_failure' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fail_collab_membership BEFORE INSERT ON public.collab_conversation_members
 FOR EACH ROW EXECUTE FUNCTION public.reject_test_membership_for_employee();

CREATE FUNCTION public.reject_test_conversation_activity()
RETURNS trigger LANGUAGE plpgsql AS $
BEGIN
 IF current_setting('test.fail_collab_activity',true)='on' THEN
  RAISE EXCEPTION 'injected_activity_failure' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $;
CREATE TRIGGER fail_collab_activity BEFORE UPDATE ON public.collab_conversations
 FOR EACH ROW EXECUTE FUNCTION public.reject_test_conversation_activity();

DO $collab$
DECLARE v jsonb; v_id uuid; n integer; failed boolean; v_last timestamptz;
BEGIN
 v:=public.create_collab_conversation_with_members(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','directa',NULL,
  ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid]);
 v_id:=(v->>'id')::uuid;
 SELECT count(*) INTO n FROM public.collab_conversation_members WHERE conversation_id=v_id;
 IF n<>2 OR (v->>'existing')::boolean THEN RAISE EXCEPTION 'Conversa directa ou participantes não foram criados'; END IF;

 v:=public.create_collab_conversation_with_members(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','directa',NULL,
  ARRAY['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]);
 IF (v->>'id')::uuid<>v_id OR NOT (v->>'existing')::boolean THEN
   RAISE EXCEPTION 'Conversa directa existente não foi reutilizada';
 END IF;

 failed:=false;
 BEGIN
  PERFORM public.create_collab_conversation_with_members(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','grupo','Grupo rollback',
   ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid]);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha injectada de participante não ocorreu'; END IF;
 SELECT count(*) INTO n FROM public.collab_conversations WHERE titulo='Grupo rollback';
 IF n<>0 THEN RAISE EXCEPTION 'Conversa parcial persistiu após falha de participante'; END IF;

 failed:=false;
 BEGIN
  PERFORM public.create_collab_conversation_with_members(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','directa',NULL,
   ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]);
 EXCEPTION WHEN SQLSTATE '22023' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Participantes duplicados não foram rejeitados'; END IF;

 failed:=false;
 BEGIN
  PERFORM public.create_collab_conversation_with_members(
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','directa',NULL,
   ARRAY['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]);
 EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '22023' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Funcionário inactivo conseguiu criar conversa'; END IF;

 v:=public.send_collab_message_with_activity(v_id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Mensagem transaccional');
 SELECT count(*) INTO n FROM public.collab_messages WHERE id=(v->>'id')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'Mensagem não foi criada'; END IF;
 SELECT last_message_at INTO v_last FROM public.collab_conversations WHERE id=v_id;
 IF v_last IS DISTINCT FROM (v->>'created_at')::timestamptz THEN
   RAISE EXCEPTION 'last_message_at não foi actualizado na mesma transacção';
 END IF;

 PERFORM set_config('test.fail_collab_activity','on',true);
 SELECT last_message_at INTO v_last FROM public.collab_conversations WHERE id=v_id;
 failed:=false;
 BEGIN
  PERFORM public.send_collab_message_with_activity(v_id,
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Esta mensagem deve sofrer rollback');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Falha injectada da actividade não ocorreu'; END IF;
 SELECT count(*) INTO n FROM public.collab_messages
 WHERE conversation_id=v_id AND body='Esta mensagem deve sofrer rollback';
 IF n<>0 THEN RAISE EXCEPTION 'Mensagem parcial persistiu após falha de last_message_at'; END IF;
 IF (SELECT last_message_at FROM public.collab_conversations WHERE id=v_id) IS DISTINCT FROM v_last THEN
   RAISE EXCEPTION 'last_message_at mudou apesar do rollback';
 END IF;

 failed:=false;
 BEGIN
  PERFORM public.send_collab_message_with_activity(v_id,
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Remetente não membro');
 EXCEPTION WHEN SQLSTATE '42501' THEN failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Remetente fora da conversa não foi rejeitado'; END IF;
END $collab$;

SELECT 'POSTGRES_COLLAB_MESSAGING_ATOMICITY_OK' AS result;
