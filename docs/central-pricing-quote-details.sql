-- Requires central-pricing-schema.sql.
create or replace function public.consultar_cotacao_cliente(
 p_funcionario_id uuid, p_cotacao_id uuid
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_cotacao public.cotacoes_clientes%rowtype;
 v_pecas jsonb;
 v_total numeric;
 v_peso bigint;
begin
 select c.* into v_cotacao from public.cotacoes_clientes c
 join public.lojas l on l.id=c.loja_id and l.ativo is true
 join public.funcionarios f on f.id=p_funcionario_id and f.ativo is true
 where c.id=p_cotacao_id and (f.role='admin' or (f.role='funcionario' and f.loja_id=c.loja_id));
 if not found then raise exception 'Cotação indisponível' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'tipo_peca',p.tipo_peca,'descricao',p.descricao,
 'qualidade_id',p.qualidade_id,'peso_miligramas',p.peso_miligramas,
 'centimos_por_grama',i.centimos_por_grama,
 'valor_centimos',round(p.peso_miligramas::numeric*i.centimos_por_grama/1000)
 ) order by p.id),'[]'::jsonb),
 coalesce(sum(round(p.peso_miligramas::numeric*i.centimos_por_grama/1000)),0),
 coalesce(sum(p.peso_miligramas),0)
 into v_pecas,v_total,v_peso
 from public.cotacoes_clientes_pecas p
 join public.publicacoes_precos_itens i on i.publicacao_id=p.publicacao_id and i.qualidade_id=p.qualidade_id
 where p.cotacao_id=v_cotacao.id;
 return to_jsonb(v_cotacao)||jsonb_build_object('pecas',v_pecas,'total_centimos',v_total,'peso_total_miligramas',v_peso);
end;
$$;
revoke all on function public.consultar_cotacao_cliente(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consultar_cotacao_cliente(uuid,uuid) to service_role;
-- The API must derive the actor from the verified session.
