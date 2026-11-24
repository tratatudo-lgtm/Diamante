-- Apply only after the central pricing schema migration.
create or replace function public.publicar_precos_compra(
 p_administrador_id uuid, p_precos jsonb, p_publicacao_anterior uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
 v_id uuid;
 v_anterior uuid;
begin
 if not exists (select 1 from public.funcionarios where id=p_administrador_id and role='admin' and ativo is true) then
   raise exception 'Administrador sem autorização' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(821726,1);
 select id into v_anterior from public.publicacoes_precos order by publicado_em desc,id desc limit 1;
 if v_anterior is distinct from p_publicacao_anterior then
   raise exception 'Tabela de preços alterada por outro administrador' using errcode='40001';
 end if;
 if p_precos is null or jsonb_typeof(p_precos) <> 'array' then
   raise exception 'Tabela inválida';
 end if;
 if jsonb_array_length(p_precos) not between 1 and 1000 then
   raise exception 'Número de preços inválido';
 end if;
 lock table public.qualidades_metal in share mode;
 if exists (
   select 1 from jsonb_to_recordset(p_precos) as p(qualidade_id uuid, centimos_por_grama integer)
   left join public.qualidades_metal q on q.id=p.qualidade_id
   where q.id is null or not q.ativo or p.centimos_por_grama is null or p.centimos_por_grama not between 1 and 10000000
 ) then raise exception 'Qualidade ou preço inválido'; end if;
 if exists (
   select 1 from public.qualidades_metal q where q.ativo and not exists (
     select 1 from jsonb_to_recordset(p_precos) as p(qualidade_id uuid, centimos_por_grama integer) where p.qualidade_id=q.id
   )
 ) then raise exception 'Faltam preços de qualidades ativas'; end if;
 insert into public.publicacoes_precos(administrador_id,publicado_em)
 values(p_administrador_id,clock_timestamp()) returning id into v_id;
 insert into public.publicacoes_precos_itens(publicacao_id,qualidade_id,centimos_por_grama)
 select v_id,p.qualidade_id,p.centimos_por_grama
 from jsonb_to_recordset(p_precos) as p(qualidade_id uuid,centimos_por_grama integer);
 return v_id;
end;
$$;
revoke all on function public.publicar_precos_compra(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.publicar_precos_compra(uuid,jsonb,uuid) to service_role;
-- Backend must derive p_administrador_id from verified session, never request body.
