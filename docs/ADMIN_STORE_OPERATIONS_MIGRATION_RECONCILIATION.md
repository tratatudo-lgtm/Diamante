# Reconciliação de migrações — operações administrativas de loja

Estado verificado em 2026-11-17. Este documento é preventivo: **não executar `supabase db push` nem aplicar migrações em produção enquanto a reconciliação abaixo não estiver concluída.**

## Estado remoto confirmado

O histórico real de `supabase_migrations.schema_migrations` contém migrações até `20261117135452`. O registo remoto usa versões diferentes das datas que actualmente aparecem em vários ficheiros locais. Exemplos confirmados pelo nome remoto:

| Versão remota | Nome remoto | Ficheiro local relacionado |
|---|---|---|
| 20261114211918 | make_store_purchase_atomic | 20261114213000_make_store_purchase_atomic.sql |
| 20261114212540, 20261114212607, 20261114212644 | make_store_purchases_idempotent (revisões) | 20261114214000_make_store_purchases_idempotent.sql |
| 20261114213521 | add_customer_nif_and_crm_fields | 20261114220000_add_customer_nif_and_crm_fields.sql |
| 20261114214721 | support_international_client_identity_and_address | 20261114223000_support_international_client_identity_and_address.sql |
| 20261114220642 | require_adult_client_birthdate | 20261114220000_require_adult_client_birthdate.sql |
| 20261114221730 | lock_down_client_document_storage | 20261114223000_lock_down_client_document_storage.sql |
| 20261115100136 | operational_task_management | 20261115094500_operational_task_management.sql |
| 20261115121510 | operational_goals_and_performance | 20261115103000_operational_goals_and_performance.sql |
| 20261115135818 | monthly_store_financial_closing | 20261115150000_monthly_store_financial_closing.sql |
| 20261117135452 | 20261117153000_persist_whatsapp_otp_challenges | 20261117153000_persist_whatsapp_otp_challenges.sql |

Estes pares são correspondências por nome, não uma prova de igualdade do conteúdo SQL. Em particular, as três revisões remotas de idempotência exigem comparação antes de qualquer operação de repair.

## Migrações de compras ainda não confirmadas no histórico remoto

- `20261115150000_add_dual_purchase_approval.sql`
- `20261115170000_gate_store_inventory_on_purchase_approval.sql`
- `20261116130000_remove_legacy_non_idempotent_store_purchase.sql`
- `20261116140000_snapshot_daily_gold_quote_on_purchase.sql`
- `20261116201000_store_purchase_signed_declaration_evidence.sql`
- `20261117023000_audit_and_protect_purchase_declarations.sql`

A função de produção foi consultada directamente e continua com 14 argumentos. O código de compras da branch usa a assinatura de 20 argumentos. O bucket e as tabelas de evidência/auditoria também não estavam presentes quando foram feitas as verificações iniciais. Por isso, estas dependências têm de ser aplicadas e validadas pela ordem correcta antes de activar compras administrativas.

## Colisões de timestamp no repositório

Foram detectados prefixos repetidos em ficheiros SQL locais:

- `20261114220000` — 2 ficheiros
- `20261114223000` — 2 ficheiros
- `20261115094500` — 2 ficheiros
- `20261115100000` — 2 ficheiros
- `20261115103000` — 3 ficheiros
- `20261115150000` — 3 ficheiros

É necessário atribuir versões únicas e manter um mapa auditável para o histórico remoto. Não se devem renomear ou marcar migrações como aplicadas sem confirmar o SQL exacto e o efeito já existente na base de dados.

## Nova migração desta branch

`20261117170000_allow_admin_store_operations.sql` acrescenta o papel real do actor à evidência documental e à transacção e actualiza a RPC de 20 argumentos para aceitar:
- funcionário activo, apenas na sua loja atribuída;
- administrador activo, numa loja activa explicitamente seleccionada.

A RPC continua a ser executável apenas por `service_role`, mantém a idempotência e cria inventário em `pendente_aprovacao`. Esta migração depende da migração de evidência assinada e não deve ser aplicada antes dela.

## Segurança e deploy

- Nenhuma migração foi aplicada à base de dados de produção.
- Nenhuma tabela ou dado de produção foi alterado.
- Nenhum deploy ou reinício de container foi efectuado.
- A Evolution API não foi tocada.

Próxima etapa: comparar o conteúdo das migrações locais com os efeitos e versões remotas, resolver os prefixos duplicados, testar a sequência completa numa base de staging e só então pedir autorização para produção.
