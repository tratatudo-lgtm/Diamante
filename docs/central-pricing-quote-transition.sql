create or replace function public.alterar_estado_cotacao(
 p_funcionario_id uuid,p_cotacao_id uuid,p_estado text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_c public.cotacoes_clientes%rowtype;
 v_atual uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(821726,1);
 select c.* into v_c from public.cotacoes_clientes c
 join public.lojas l on l.id=c.loja_id and l.ativo is true
 join public.funcionarios f on f.id=p_funcionario_id and f.ativo is true
 where c.id=p_cotacao_id and (f.role='admin' or (f.role='funcionario' and f.loja_id=c.loja_id))
 for update of c;
 if not found then raise exception 'Cotação indisponível' using errcode='42501'; end if;
 if p_estado is null or not (
 (v_c.estado='rascunho' and p_estado in ('apresentada','recusada','expirada'))
 or (v_c.estado='apresentada' and p_estado in ('aceite','recusada','expirada'))
 or (v_c.estado='aceite' and p_estado='expirada')
 ) then raise exception 'Transição inválida'; end if;
 if p_estado='expirada' and v_c.expira_em>clock_timestamp() then
 raise exception 'Cotação ainda válida'; end if;
 if p_estado in ('apresentada','aceite') and v_c.expira_em<=clock_timestamp() then
 raise exception 'Cotação expirada'; end if;
 if p_estado='apresentada' then
 select id into v_atual from public.publicacoes_precos order by publicado_em desc,id desc limit 1;
 if v_atual is distinct from v_c.publicacao_id then
 raise exception 'Preços alterados: prepare nova cotação' using errcode='40001'; end if;
 end if;
 update public.cotacoes_clientes set estado=p_estado where id=v_c.id;
 return public.consultar_cotacao_cliente(p_funcionario_id,p_cotacao_id);
end;
$$;
revoke all on function public.alterar_estado_cotacao(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.alterar_estado_cotacao(uuid,uuid,text) to service_role;
-- Conversion is deliberately excluded; only the atomic purchase RPC may mark converted.
-- Acceptance records the employee's action; it is not a substitute for signed evidence.
