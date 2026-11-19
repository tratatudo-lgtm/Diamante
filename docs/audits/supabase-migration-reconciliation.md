# Supabase migration reconciliation (read-only audit)

Audit baseline:
- GitHub branch: `integration/pr8-pr10-pr5-20261118`
- Commit inspected: `57b7095bfc1317befed8aa3c064e0f62fcda7e7f`
- Supabase project: `ytpetuvvxbmlafsisfaf`
- Remote migration ledger: 63 rows
- Local migration files: 95

This document is an inventory, not an instruction to rename, delete, repair, or apply migrations. Migration names and timestamps alone do not prove SQL equivalence. Production was queried read-only; no schema, migration ledger, data, or storage was changed.

## Findings

### Duplicate local timestamps

| Version | Files |
|---|---|
| 20261114220000 | add_customer_nif_and_crm_fields; require_adult_client_birthdate |
| 20261114223000 | lock_down_client_document_storage; support_international_client_identity_and_address |
| 20261115094500 | operational_task_management; prevent_ambiguous_birthday_resends |
| 20261115100000 | collaboration_notifications; index_client_document_history_foreign_keys |
| 20261115103000 | audit_birthday_whatsapp_consent_changes; operational_goals_and_performance; performance_goals |
| 20261115150000 | add_dual_purchase_approval; index_collaboration_foreign_keys; monthly_store_financial_closing |
| 20261118190000 | atomic_operational_updates_audit; audit_gold_refining_completion |
| 20261118210000 | atomic_collab_comment_audit; guard_gold_batch_completion |
| 20261118220000 | add_financial_payment_audit; atomic_crm_opportunity_expansion_writes |
| 20261118230000 | add_operational_expense_audit; atomic_employee_time_clock |

### Duplicate names in the remote ledger

- `require_active_employee_for_inventory_and_kpis`: versions `20261114134646`, `20261114134653`.
- `make_store_purchases_idempotent`: versions `20261114212540`, `20261114212607`, `20261114212644`.

### Remote ledger names without an exact local filename slug

- `20261113175954 crm_relations_suppliers_and_attachments`
- `20261113182818 secure_transaction_creation_through_api`
- `20261117135452 20261117153000_persist_whatsapp_otp_challenges`

The last item appears to be a timestamp/name mismatch, not proof that its SQL is absent.

### Local filename slugs absent from the remote ledger

37 files are not matched by exact name. They include purchase approval/evidence, gold receiving/refining, financial audit, atomic collaboration, client document replacement, time clock, CRM/expansion writes, and other newer work. These are not automatically safe to apply: each needs dependency and SQL review.

### Important timestamp drift

Many local filenames have timestamps different from the remote version for the same slug. Some remote versions also have multiple rows with the same name. Consequently, a name-only or timestamp-only reconciliation is unsafe.

## Safe resolution plan

1. Preserve every remote ledger row and its version exactly; do not run `migration repair` or alter the production ledger.
2. Fetch and compare SQL contents for each remote/local name candidate, including historical duplicates.
3. Classify each local file as: exact applied equivalent, modified equivalent, missing historical source, unapplied additive migration, or ambiguous.
4. Resolve duplicate local versions on a separate clean-install migration stream or through reviewed, content-proven consolidation. Never silently renumber a migration already recorded remotely.
5. Test the proposed clean-install stream against a disposable PostgreSQL database and separately test upgrades from the recorded production baseline.
6. Only after those checks, prepare a deployment plan for explicit approval.

## Explicit non-actions

- No Supabase migration was applied.
- No migration history was repaired or changed.
- No VPS or Evolution API action was performed.
- No merge or deployment was performed.

## Production schema cross-check (read-only)

A separate verbose `list_tables` inspection returned 54 public tables. This is an important qualification: absence from the migration ledger by filename does not imply that the feature's schema is absent. The following objects/columns were observed in the live schema:

- Present: `whatsapp_otp_challenges` (including consumed/rate-limit fields).
- Present: `crm_opportunities`, `crm_expansion_sites`, `operational_tasks`, `operational_goals`, `collab_conversations`, `collab_reports`, `registos_ponto`.
- Present: `fechos_financeiros_loja` and `fechos_financeiros_eventos`, with reopen metadata and event snapshot columns.
- Present: `despesas_operacionais` with approval/payment actor and timestamp columns.
- `transacoes` includes `idempotency_key`, but the inspected columns do not include the newer signed-declaration evidence linkage.
- Not present in the public schema snapshot: `store_purchase_consent_evidence` and `store_purchase_declaration_access_logs`.

This schema snapshot is not proof that a particular local migration was applied: objects may predate the local files, be created by a differently named migration, or have been changed manually. The two absent evidence tables remain candidates for unapplied schema work, subject to dependency and SQL review. The earlier list of 37 filename slugs without a ledger-name match must therefore be treated as an investigation queue, not an "unapplied migrations" list.


## Reconciliation update — 2026-11-19

The filename-collision inventory above records the initial audit and is superseded by this section for the current branch state.

### Changes committed to the integration branch

- Aligned **46 local migration files** to the exact version IDs in the remote ledger. For each of these files, the Git blob SHA was checked against the corresponding historical file in `rebuild/diamante-douro-secure`; all 46 matched exactly before renaming.
- Moved the dual-purchase-approval migration to `20261116003000_add_dual_purchase_approval.sql`, using the unchanged blob from PR #6.
- Moved `performance_goals` to `20261116120000_performance_goals.sql`, using the unchanged blob from PR #6.
- Resolved four collisions among newly authored migrations by retaining their SQL blobs and assigning distinct version prefixes:
  - `20261118190001_audit_gold_refining_completion.sql`
  - `20261118210001_guard_gold_batch_completion.sql`
  - `20261118220001_atomic_crm_opportunity_expansion_writes.sql`
  - `20261118230001_atomic_employee_time_clock.sql`

The branch now has 95 SQL migration files and **zero duplicate 14-digit version prefixes**.

### Deliberately unresolved historical ambiguity

`make_store_purchases_idempotent` has three remote ledger rows (`20261114212540`, `20261114212607`, `20261114212644`) but only one local SQL file (`20261114214000_make_store_purchases_idempotent.sql`). The single local file cannot be mapped one-to-one to three historical migration bodies. It was deliberately left unchanged and must not be auto-renamed or applied until the original three SQL bodies are recovered and compared.

The two remote rows for `require_active_employee_for_inventory_and_kpis` each have a corresponding local file; both local blobs match the historical branch blobs and both remote version IDs are preserved.

### Production schema evidence

A read-only catalog query confirmed the client identity fields, adult-validation function, birthday queue/consent functions and consent audit table, operational task/goal tables, collaboration notifications, monthly closing table, financial transactions and client document table. It did not find the two signed purchase declaration evidence tables. The monthly-close function lookup used an initial guessed name and is not treated as evidence of absence.

### Validation status

- Static filename audit: the current tree contains zero duplicate version prefixes.
- CI for the new commit: awaiting completion at the time this section was written.
- No production migration was applied, no remote migration ledger was edited, and no VPS/Evolution API operation was performed.


### Final validation and remaining ledger exceptions

After the initial failed PostgreSQL run, the two integration scripts were updated to reference the reconciled filenames. A full run on commit `828f5749de74c286ce5b979d05de25c448f9e196` completed with **all four jobs successful**:
- `validate` (TypeScript, unit tests, build): success
- `migration-filename-audit`: success
- `postgres-finance-integration`: success
- `postgres-operational-atomicity`: success

The OTP migration was also aligned to the remote ledger's unusual exact name/version pair: local `20261117153000_persist_whatsapp_otp_challenges.sql` is now `20261117135452_20261117153000_persist_whatsapp_otp_challenges.sql`. The ledger name contains the full original local filename, and a read-only production catalog query confirmed the table plus all three expected RPC signatures, SECURITY DEFINER status, service_role EXECUTE and no authenticated EXECUTE. The SQL blob was preserved unchanged. This is strong schema/ledger correspondence, not a byte-for-byte comparison with an unavailable remote SQL body.

Current branch snapshot after that rename: 95 SQL files, zero duplicate version prefixes. The rename itself changes only the filename; CI is re-running for the latest commit.

Still unresolved:
- Three remote ledger entries for `make_store_purchases_idempotent` versus one local file. Original three SQL bodies are not available in the current historical branch; no mapping or renumbering was attempted.
- Remote-only ledger migrations `crm_relations_suppliers_and_attachments` and `secure_transaction_creation_through_api` have no corresponding local SQL file in the inspected branch trees. Their SQL must be recovered from source history before a clean-install stream can be certified.
- The OTP row above is mapped by exact ledger name and schema signature, but remote SQL source is unavailable for a blob comparison.

No remote ledger repair or production DDL was performed.
