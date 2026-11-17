# Reconciliação de migrações — operações administrativas de loja

Verificação em 2026-11-17. Este documento descreve o estado observado no Supabase Cloud e uma sequência proposta para staging. **Não executar `supabase db push`, não usar `migration repair` e não aplicar SQL em produção com base apenas neste documento.**

## Estado remoto observado

Project ref: `ytpetuvvxbmlafsisfaf`.

O histórico remoto contém versões até `20261117135452`. A função de compras actualmente instalada é:

`create_store_purchase(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,text)`

A definição foi lida directamente em `pg_proc`. É `SECURITY DEFINER`, com `search_path` fixo, e o ACL observado permite execução a `service_role` (além do owner postgres), não a `anon` nem `authenticated`. A função actual:
- aceita apenas `role = 'funcionario'` e a loja atribuída;
- usa `idempotency_key`;
- cria inventário com estado `em_loja`, sem exigir aprovação final.

A coluna `transacoes.idempotency_key` existe. Não foram encontradas as colunas `primeira_aprovacao_por`, `data_primeira_aprovacao`, `cotacao_origem`, `cotacao_moeda`, `cotacao_unidade`, `cotacao_observada_em`, `declaracao_assinada_id` ou `registado_por_role`.

Não existem as tabelas `store_purchase_consent_evidence` e `store_purchase_declaration_access_logs`, nem o bucket `declaracoes-compras`.

Uma consulta de integridade encontrou **0** registos de inventário `em_loja` cuja transacção de origem esteja ainda `pendente_aprovacao`. Não foram alterados dados.

## Migrações no histórico remoto com nomes relacionados

| Versão remota | Nome |
|---|---|
| 20261114211918 | make_store_purchase_atomic |
| 20261114212540 | make_store_purchases_idempotent |
| 20261114212607 | make_store_purchases_idempotent |
| 20261114212644 | make_store_purchases_idempotent |
| 20261114213521 | add_customer_nif_and_crm_fields |
| 20261114214721 | support_international_client_identity_and_address |
| 20261114220642 | require_adult_client_birthdate |
| 20261114221730 | lock_down_client_document_storage |
| 20261115100136 | operational_task_management |
| 20261115121510 | operational_goals_and_performance |
| 20261115135818 | monthly_store_financial_closing |
| 20261117135452 | 20261117153000_persist_whatsapp_otp_challenges |

A semelhança de nomes não prova que o conteúdo SQL local é igual ao que foi aplicado remotamente. As três versões remotas de idempotência devem ser comparadas por efeito e definição de função, não apenas pelo nome.

## Migrações de compras em falta no histórico remoto

A sequência de dependências que deve ser ensaiada numa branch de desenvolvimento/staging é:

1. `20261115150000_add_dual_purchase_approval.sql` — campos da primeira aprovação.
2. `20261115170000_gate_store_inventory_on_purchase_approval.sql` — reconciliação de inventário e promoção após aprovação final.
3. `20261116130000_remove_legacy_non_idempotent_store_purchase.sql` — remoção apenas da assinatura antiga de 13 argumentos, depois de confirmar a assinatura existente.
4. `20261116140000_snapshot_daily_gold_quote_on_purchase.sql` — snapshot de cotação e RPC de 18 argumentos.
5. `20261116201000_store_purchase_signed_declaration_evidence.sql` — bucket privado, evidência e RPC de 19 argumentos.
6. `20261117023000_audit_and_protect_purchase_declarations.sql` — auditoria de acesso e protecção da evidência.
7. `20261117170000_allow_admin_store_operations.sql` — papel real do actor e autorização de administrador para loja activa seleccionada.

A ordem acima é uma proposta baseada nas dependências visíveis nos ficheiros. Antes de a executar em staging, verificar cada pré-condição, os nomes e assinaturas das funções, os triggers, índices, constraints, políticas Storage e grants. A migração 3 não deve remover a assinatura de produção de 14 argumentos; a migração 4 substitui essa assinatura de 14 argumentos pela versão com snapshot de cotação.

A RPC final deve manter `SECURITY DEFINER` apenas com `search_path` fixo e `EXECUTE` reservado a `service_role`. O backend valida o actor autenticado e a loja activa; a função SQL volta a validar o perfil e a associação actor/loja. A migração administrativa preserva o ID real em `funcionario_id` por compatibilidade com a FK e grava o perfil em `registado_por_role`/ `actor_role`.

## Colisões de timestamp no repositório

Existem prefixos repetidos entre migrações locais (`20261114220000`, `20261114223000`, `20261115094500`, `20261115100000`, `20261115103000`, `20261115150000`). A equipa deve mapear cada ficheiro para o seu efeito real e atribuir versões únicas apenas às migrações ainda não aplicadas. Não renomear migrações já registadas nem usar `migration repair` para esconder diferenças de esquema.

## Verificações da aplicação

O CI do commit `58cc61395f49fdaef2cc7a48d4946be32b40277c` terminou com sucesso: validação TypeScript, testes unitários e build de produção.

## Segurança operacional

- Nenhuma migração foi aplicada à produção.
- Nenhuma tabela, função, bucket ou dado de produção foi alterado nesta investigação.
- Nenhum deploy/restart da VPS foi efectuado.
- A Evolution API não foi tocada.
- O ensaio seguinte deve ocorrer numa branch Supabase de desenvolvimento ou projecto de staging, nunca directamente na produção.
