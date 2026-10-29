-- 001: Schemas.
-- Each module owns one schema (docs/Architecture_Module_Boundaries.md):
--   system      tenants and tenant settings               (System)
--   auth        users, roles, rights and sessions          (Identity)
--   accounting  ledger accounts, journals, posting rules   (Accounting)
--   loans       customers, vehicles, lenders, loan files   (Loans)
--   leads       leads and product types                    (Leads)
--   partners    sub-brokers and DSA agents                 (Partners)
--   public      the migration history only (public.schema_migrations, created by run_migrations.ps1)
-- Identifiers use gen_random_uuid(), built into PostgreSQL 13 and later, so no extension is needed.

CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS loans;
CREATE SCHEMA IF NOT EXISTS leads;
CREATE SCHEMA IF NOT EXISTS partners;
