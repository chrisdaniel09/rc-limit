-- 028: Leads owns its data in the "leads" schema, with no foreign keys to other schemas.
--   * Moves leads, lead_check_logs and lead_customers into schema leads.
--   * Drops every foreign key that points from those tables (or customer_vehicles.source_lead_id)
--     to a table outside the lead tables. Those columns stay as plain ids.
--   * Moves lead comments from entity_comments into leads.lead_comments and tightens entity_comments
--     to CUSTOMER and LOAN only.
-- Runs as a single transaction. Safe to re-run: every step checks its current state first.
--
-- Reverse (manual, if ever needed): move the tables back with ALTER TABLE ... SET SCHEMA public,
-- copy leads.lead_comments rows back into entity_comments with entity_type = 'LEAD', and restore the
-- foreign keys listed in the header of 018/022. Data backup is taken before running (see phase 3 notes).

BEGIN;

CREATE SCHEMA IF NOT EXISTS leads;

-- 1. Drop cross-schema foreign keys (matched by what they reference, not by name).
DO $$
DECLARE
    lead_tables regclass[];
    r record;
BEGIN
    lead_tables := ARRAY[
        to_regclass('public.leads'),
        to_regclass('public.lead_check_logs'),
        to_regclass('public.lead_customers')
    ];

    FOR r IN
        SELECT c.conrelid::regclass AS child, c.conname
        FROM pg_constraint c
        WHERE c.contype = 'f'
          AND (
            -- lead tables pointing outside the lead tables
            (c.conrelid = ANY (lead_tables) AND NOT (c.confrelid = ANY (lead_tables)))
            OR
            -- customer_vehicles pointing back into leads
            (c.conrelid = to_regclass('public.customer_vehicles') AND c.confrelid = to_regclass('public.leads'))
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child, r.conname);
    END LOOP;
END $$;

-- 2. Move the lead tables into the leads schema (their indexes and constraints move with them).
DO $$
BEGIN
    IF to_regclass('public.leads') IS NOT NULL THEN
        ALTER TABLE public.leads SET SCHEMA leads;
    END IF;
    IF to_regclass('public.lead_check_logs') IS NOT NULL THEN
        ALTER TABLE public.lead_check_logs SET SCHEMA leads;
    END IF;
    IF to_regclass('public.lead_customers') IS NOT NULL THEN
        ALTER TABLE public.lead_customers SET SCHEMA leads;
    END IF;
END $$;

-- 3. Lead comments get their own table. Only tenant_id and user ids are kept as plain ids.
CREATE TABLE IF NOT EXISTS leads.lead_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads.leads(lead_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_comments_lead
    ON leads.lead_comments(tenant_id, lead_id, created_at DESC);

-- 4. Copy existing lead comments across. Refuse to continue if any would be orphaned.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.entity_comments ec
        WHERE ec.entity_type = 'LEAD'
          AND NOT EXISTS (SELECT 1 FROM leads.leads l WHERE l.lead_id = ec.entity_id)
    ) THEN
        RAISE EXCEPTION 'Orphaned LEAD comments exist in entity_comments; resolve them before running 028';
    END IF;
END $$;

INSERT INTO leads.lead_comments (comment_id, tenant_id, lead_id, comment_text, created_by_user_id, created_at)
SELECT ec.comment_id, ec.tenant_id, ec.entity_id, ec.comment_text, ec.created_by_user_id, ec.created_at
FROM public.entity_comments ec
WHERE ec.entity_type = 'LEAD'
ON CONFLICT (comment_id) DO NOTHING;

DELETE FROM public.entity_comments WHERE entity_type = 'LEAD';

-- 5. entity_comments now serves customers and loans only.
ALTER TABLE public.entity_comments DROP CONSTRAINT IF EXISTS entity_type_check;
ALTER TABLE public.entity_comments
    ADD CONSTRAINT entity_type_check CHECK (entity_type IN ('CUSTOMER', 'LOAN'));

-- 6. Grant the application role access when it exists (not every environment has it).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT USAGE ON SCHEMA leads TO app_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA leads TO app_user;
    END IF;
END $$;

COMMIT;
