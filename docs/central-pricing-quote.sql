-- Requires central-pricing-schema.sql and publication RPC.
create or replace function public.criar_cotacao_cliente(
 p_funcionario_id uuid, p_loja_id uuid, p_cliente_id uuid,
 p_publicacao_id uuid, p_pecas jsonb
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare
 v_id uuid;
 v_publicacao uuid;
begin
 if not exists (
 select 1 from public.funcionarios
 where id=p_funcionario_id and ativo is true
 and (role='admin' or (role='funcionario' and loja_id=p_loja_id))
 ) then raise exception 'Sem acesso à loja' using errcode='42501'; end if;
 if p_pecas is null or jsonb_typeof(p_pecas)<>'array' then
 raise exception 'Peças inválidas'; end if;
 if jsonb_array_length(p_pecas) not between 1 and 100 then
 raise exception 'Número de peças inválido'; end if;
 perform pg_catalog.pg_advisory_xact_lock(821726,1);
 select id into v_publicacao from public.publicacoes_precos order by publicado_em desc,id desc limit 1;
 if v_publicacao is null or v_publicacao is distinct from p_publicacao_id then
 raise exception 'Atualize os preços antes de criar a cotação' using errcode='40001'; end if;
 if exists (
 select 1 from jsonb_to_recordset(p_pecas) as p(qualidade_id uuid,tipo_peca text,descricao text,peso_miligramas integer)
 left join public.publicacoes_precos_itens i on i.publicacao_id=v_publicacao and i.qualidade_id=p.qualidade_id
 left join public.qualidades_metal q on q.id=p.qualidade_id
 where i.qualidade_id is null or q.ativo is not true
 or p.peso_miligramas is null or p.peso_miligramas not between 1 and 10000000
 or p.tipo_peca is null or length(trim(p.tipo_peca)) not between 1 and 100
 or length(coalesce(p.descricao,''))>2000
 or round(p.peso_miligramas::numeric*i.centimos_por_grama/1000)<1
 ) then raise exception 'Peça, peso ou qualidade inválida'; end if;
 insert into public.cotacoes_clientes(loja_id,funcionario_id,cliente_id,publicacao_id,expira_em)
 values(p_loja_id,p_funcionario_id,p_cliente_id,v_publicacao,clock_timestamp()+interval '30 minutes')
 returning id into v_id;
 insert into public.cotacoes_clientes_pecas(cotacao_id,publicacao_id,qualidade_id,tipo_peca,descricao,peso_miligramas)
 select v_id,v_publicacao,p.qualidade_id,trim(p.tipo_peca),coalesce(p.descricao,''),p.peso_miligramas
 from jsonb_to_recordset(p_pecas) as p(qualidade_id uuid,tipo_peca text,descricao text,peso_miligramas integer);
 return v_id;
end;
$$;
revoke all on function public.criar_cotacao_cliente(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.criar_cotacao_cliente(uuid,uuid,uuid,uuid,jsonb) to service_role;
-- Draft: backend must enforce existing store and client access rules and derive actor from verified session.
-- Expiration policy of 30 minutes is provisional and must be configurable before release.
