-- Draft: requires preceding central pricing schema and RPCs.
alter table public.store_purchase_consent_evidence add column cotacao_id uuid unique references public.cotacoes_clientes(id);
alter table public.inventario_fisico add column cotacao_peca_id uuid unique references public.cotacoes_clientes_pecas(id);
create or replace function public.converter_cotacao_compra(p_actor uuid,p_cotacao uuid,p_evidencia uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 c public.cotacoes_clientes%rowtype;
 cl public.clientes%rowtype;
 e public.store_purchase_consent_evidence%rowtype;
 v_role text;
 v_total numeric;
 v_peso numeric;
 v_id uuid;
begin
 select q.* into c from public.cotacoes_clientes q
 join public.lojas l on l.id=q.loja_id and l.ativo is true
 join public.funcionarios f on f.id=p_actor and f.ativo is true
 where q.id=p_cotacao and (f.role='admin' or (f.role='funcionario' and f.loja_id=q.loja_id))
 for update of q;
 if not found then raise exception 'Sem acesso' using errcode='42501'; end if;
 select role into v_role from public.funcionarios where id=p_actor;
 select * into e from public.store_purchase_consent_evidence where id=p_evidencia
 and cotacao_id=c.id and idempotency_key=c.id and loja_id=c.loja_id and funcionario_id=p_actor for update;
 if not found then raise exception 'Declaração não vinculada' using errcode='42501'; end if;
 if c.estado='convertida' then
 if exists(select 1 from public.transacoes where id=c.transacao_id and declaracao_assinada_id=e.id and funcionario_id=p_actor) then return c.transacao_id; end if;
 raise exception 'Conversão incompatível';
 end if;
 if c.estado<>'aceite' or c.expira_em<=clock_timestamp() then raise exception 'Cotação não válida'; end if;
 select * into strict cl from public.clientes where id=c.cliente_id;
 if e.cliente_nome is distinct from trim(cl.nome) or e.cliente_documento is distinct from trim(cl.bi_cc) then raise exception 'Identificação divergente'; end if;
 select sum(round(p.peso_miligramas::numeric*i.centimos_por_grama/1000))/100,sum(p.peso_miligramas::numeric)/1000
 into v_total,v_peso from public.cotacoes_clientes_pecas p
 join public.publicacoes_precos_itens i on i.publicacao_id=p.publicacao_id and i.qualidade_id=p.qualidade_id
 where p.cotacao_id=c.id;
 if v_total is null or v_total<=0 or v_total>100000000 or v_peso<=0 or v_peso>100000 then raise exception 'Totais inválidos'; end if;
 insert into public.transacoes(idempotency_key,declaracao_assinada_id,loja_id,funcionario_id,cliente_id,cliente_nome,cliente_cc,cliente_contacto,tipo_peca,metal,peso_gramas,valor_final,valor_sugerido,estado,cotacao_origem,cotacao_moeda)
 values(c.id,e.id,c.loja_id,p_actor,cl.id,cl.nome,cl.bi_cc,cl.telemovel,'Múltiplas peças','Diversos',v_peso,v_total,v_total,'pendente_aprovacao','precos_finais_sede','EUR') returning id into v_id;
 insert into public.inventario_fisico(loja_atual_id,transacao_origem_id,codigo_unico,tipo_peca,metal,peso_gramas,estado,cotacao_peca_id,observacoes)
 select c.loja_id,v_id,'INV-'||upper(replace(gen_random_uuid()::text,'-','')),p.tipo_peca,q.metal||' '||q.toque::text||'‰',p.peso_miligramas::numeric/1000,'pendente_aprovacao',p.id,p.descricao
 from public.cotacoes_clientes_pecas p join public.qualidades_metal q on q.id=p.qualidade_id where p.cotacao_id=c.id;
 update public.cotacoes_clientes set estado='convertida',transacao_id=v_id where id=c.id;
 return v_id;
end;
$$;
revoke all on function public.converter_cotacao_compra(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.converter_cotacao_compra(uuid,uuid,uuid) to service_role;
-- Before release: bind signed document to immutable item snapshot, verify client eligibility,
-- enforce immutable catalog/quote lines, audit actor role and test approval/finance triggers.
