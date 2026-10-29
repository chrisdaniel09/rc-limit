# RCLimit database

PostgreSQL 13 or later (developed on 18). The schema follows the module boundaries in
`docs/Architecture_Module_Boundaries.md`: one schema per module, and no foreign keys between modules.

## Layout

| Path | Contents |
|---|---|
| `migrations/` | Schema changes. Each runs once, in file-name order, in its own transaction. |
| `seed/` | Data. Idempotent; runs on every invocation, each file in its own transaction. |
| `scripts/drop_all.sql` | Deletes every RCLimit schema and all data in the connected database. |
| `run_migrations.ps1` | Creates the database if needed, applies pending migrations, then the seeds. |

### Migrations

| File | Module | Contents |
|---|---|---|
| `001_schemas.sql` | all | `system`, `auth`, `accounting`, `leads` schemas |
| `002_system.sql` | System | tenants, tenant settings (session policy) |
| `003_auth.sql` | Identity | users, identities, refresh tokens (session families), roles, rights |
| `004_accounting.sql` | Accounting | ledger accounts, journal entries and lines, posting rules |
| `005_partners.sql` | Partners | partners |
| `006_loans_reference.sql` | Loans | lenders, bank pools, particular types, counterparties, document statuses |
| `007_loans_customers_vehicles.sql` | Loans | customers, sub-limits, vehicles, ownership history, verification logs, comments |
| `008_loans_lifecycle.sql` | Loans | loan files, ledger entries, RC tracker, application-number sequence, outbox |
| `009_leads.sql` | Leads | product types, leads, action runs, check logs, lead-customer links, comments |
| `010_app_role_grants.sql` | all | grants to `app_user`, only if that role exists |

Loans and Partners tables are still in `public`; moving them to their own schemas is planned
(`docs/loan_lifecycle_file_revamp_specification.md` sections 11-13).

### Seeds

| File | Contents | Environments |
|---|---|---|
| `001_tenant_and_access.sql` | default tenant, rights catalogue, SuperAdmin role (all rights), admin user | all non-production; production only with a changed admin password |
| `002_tenant_configuration.sql` | per tenant: application-number sequence, lead product types, counterparties, particular types, document statuses; default tenant: chart of accounts, posting rules | all |
| `003_sample_data.sql` | lenders, pools, partners, customers, vehicles, a disbursed loan with its ledger, a loan in credit review | development only |

Seed admin: `admin@annafinance.in` / `Admin@123`. The tenant is resolved from the request's Origin host
(CrossSite profile), for example `http://anna-finance.localhost`.

## Running

The password is never stored in the script. Pass `-Password`, or set `RCLIMIT_DB_PASSWORD` or `PGPASSWORD`.
`psql` must be on PATH.

```powershell
$env:RCLIMIT_DB_PASSWORD = '<password>'

.\run_migrations.ps1                          # create or update rclimit, with sample data
.\run_migrations.ps1 -NoSampleData            # without sample data
.\run_migrations.ps1 -SkipSeed                # migrations only
.\run_migrations.ps1 -Reset                   # drop everything, rebuild (asks you to type the database name)
.\run_migrations.ps1 -Database rclimit_test -Reset -Force   # rebuild a test database without asking
```

To delete everything without rebuilding:

```powershell
psql -h localhost -U postgres -d rclimit -f scripts\drop_all.sql
```

`drop_all.sql` removes the `system`, `auth`, `accounting` and `leads` schemas and recreates `public` empty,
which also clears the migration history. It keeps the database itself.

## Changing the schema

- Add a new file, for example `migrations/011_loan_pdd_documents.sql`. Never edit an applied migration:
  the runner records a checksum and reports changed files, but does not re-apply them.
- Write migrations to run inside a transaction (the runner wraps each file). Do not add `BEGIN`/`COMMIT`.
- Keep a table in its module's schema. Refer to other modules' rows by plain id, never by foreign key.
- Put data in `seed/`, written to be re-runnable (`ON CONFLICT DO NOTHING`, or `WHERE NOT EXISTS`).
- After a schema change, the EF mappings in `rclimit-backend-api/src/Modules/*/Infrastructure/Persistence`
  must match it.

## Existing databases

The baseline was introduced on 2026-10-29 and replaces the earlier migrations 001-033 (in git history).
A database built from the old files has no `public.schema_migrations` table, so the runner would try to
create every table again and stop at the first one.

- **Development databases:** run `.\run_migrations.ps1 -Reset`. This deletes all data.
- **A database with data to keep (for example production):** do not run the runner against it. It needs an
  upgrade script that brings it to the baseline schema, followed by recording 001-010 in
  `public.schema_migrations`. That script has not been written; plan it before upgrading production.

## What the baseline changed

The baseline was rebuilt from the old migration chain and checked column by column against the EF models
(every mapped table and column exists, with matching nullability and timestamp types). Differences from the
old chain:

| Change | Reason |
|---|---|
| Old migration 019 failed on a fresh database (grant to a missing `app_user` role), and 021 failed (`tenants` without its schema), so `post_disbursement_document_statuses` was never created and seed 001 stopped half way | Fixed; the grants are conditional (010) and the table is in 006 |
| `created_at` on rights, roles, counterparties and document statuses is `timestamptz` (was `timestamp`) | EF writes UTC `DateTime`, which Npgsql refuses to store in `timestamp` columns, so creating those rows through the API failed |
| About 60 columns with defaults are `NOT NULL` | EF treats them as required |
| Foreign keys to other modules removed: tenant and user references from `auth`, `public.entity_comments`, `public.customer_vehicles`, document statuses; `loan_transactions.partner_id` | Module boundary rule: no foreign keys between modules |
| Check constraints added for `loan_status`, `product_type`, loan amounts, and a non-negative running balance | Enforce the loan state machine and ledger rules in the database too |
| 18 redundant indexes removed (each duplicated a unique constraint or a longer index) | No query benefit; slower writes |
| `auth.refresh_tokens.device_info` removed | Not mapped or used |
| `gen_random_uuid()` instead of `uuid_generate_v4()`; identity columns instead of serial | No `uuid-ossp` extension needed |
| Seeds: rights in one place, seeds idempotent, sample data split out and made consistent (vehicles have owners, sub-limits and pools match the sample loan) | Re-runnable, and sample data no longer needed in other environments |
| Runner: no committed password, stops at the first error and shows it, records applied migrations, `-Reset` and `-NoSampleData` | The old runner ignored failures and re-ran every file on every run |

The particular-type codes `INSSRUANCE_PAYMENT`, `CONVENINECE_FEES` and `APPROX_FORECLOSER` keep their
spelling on purpose: they match the lender's Excel dropdown (`docs/RC_Limit_System_Specification.md`).

### Where the old migrations went

| Old files | Now in |
|---|---|
| 001 | 001 |
| 002, 025 | 002 |
| 003, 017, 020, 024 | 003 |
| 004, 014 | 004 |
| 008 | 005 |
| 005, 015, 016, 021 | 006 (lenders also get `pdd_sla_days` from 033) |
| 006, 007, 012, 019, 022 (customer vehicles) | 007 |
| 009, 011, 027, 033 | 008 |
| 010, 013, 018, 022 (lead customers), 028, 029, 030, 032 | 009 |
