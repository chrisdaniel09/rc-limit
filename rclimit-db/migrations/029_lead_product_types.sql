-- 029: Product-neutral leads, step 1 (additive).
--   * Creates leads.product_types: tenant-configurable financial requirements.
--   * Seeds the five default types for every existing tenant.
--   * Adds product_type_code, requested_amount, product_details and reference_number to leads.leads.
--   * Backfills the new columns from the legacy vehicle and loan columns. The legacy columns stay in place
--     until migration 031, so the current backend keeps working during rollout.
-- Like 028, there are no foreign keys to other schemas. tenant_id and product_type_code are plain values.
-- Runs as a single transaction. Safe to re-run.

BEGIN;

-- 1. Configurable product types (a Financial Requirement in the UI).
CREATE TABLE IF NOT EXISTS leads.product_types (
    product_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(30) NOT NULL,
    label VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Each entry: key, label, type, required, optional role, validation {pattern, min, max, options}.
    field_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Ordered actions run for a lead of this type. Each entry: code (maps to an IAction implementation),
    -- order (execution sequence), config (options passed to that implementation when it is created).
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_types_tenant_code UNIQUE (tenant_id, code)
);

-- 2. Seed the default product types for every existing tenant. Re-runs do nothing.
INSERT INTO leads.product_types
    (tenant_id, code, label, sort_order, field_schema, actions)
SELECT t.tenant_id, d.code, d.label, d.sort_order, d.field_schema::jsonb, d.actions::jsonb
FROM system.tenants t
CROSS JOIN (VALUES
    ('USED_CV', 'Used Commercial Vehicle', 1,
     '[{"key":"registration_number","label":"Vehicle registration number","type":"text","required":true,
        "role":"vehicle_registration","validation":{"pattern":"^[A-Za-z]{2}[ -]?[0-9]{1,2}[ -]?[A-Za-z]{0,3}[ -]?[0-9]{4}$"}}]',
     '[{"code":"CIBIL_CHECK","order":1,"config":{}},{"code":"VAHAN_CHECK","order":2,"config":{}}]'),
    ('NEW_CV', 'New Commercial Vehicle', 2,
     '[{"key":"registration_number","label":"Vehicle registration number","type":"text","required":false,
        "role":"vehicle_registration","validation":{"pattern":"^[A-Za-z]{2}[ -]?[0-9]{1,2}[ -]?[A-Za-z]{0,3}[ -]?[0-9]{4}$"}}]',
     '[{"code":"CIBIL_CHECK","order":1,"config":{}},{"code":"VAHAN_CHECK","order":2,"config":{}}]'),
    ('GENERAL_INSURANCE', 'General Insurance', 3, '[]', '[]'),
    ('LIFE_INSURANCE',    'Life Insurance',    4, '[]', '[]'),
    ('OTHER',             'Other',             5, '[]', '[]')
) AS d(code, label, sort_order, field_schema, actions)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3. New generic columns on leads.
--    DEFAULT 'USED_CV' keeps the current backend's inserts valid until it sends product_type_code itself.
ALTER TABLE leads.leads ADD COLUMN IF NOT EXISTS product_type_code VARCHAR(30) NOT NULL DEFAULT 'USED_CV';
ALTER TABLE leads.leads ADD COLUMN IF NOT EXISTS requested_amount NUMERIC(15,2);
ALTER TABLE leads.leads ADD COLUMN IF NOT EXISTS product_details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads.leads ADD COLUMN IF NOT EXISTS reference_number VARCHAR(30);

-- 4. Backfill from the legacy columns.
UPDATE leads.leads
SET requested_amount = requested_loan_amount
WHERE requested_amount IS NULL AND requested_loan_amount IS NOT NULL;

UPDATE leads.leads
SET product_details = jsonb_build_object('registration_number', vehicle_registration_number)
WHERE product_details = '{}'::jsonb AND vehicle_registration_number IS NOT NULL;

-- Same normalisation as VehiclesModuleApi.NormalizeRegistrationNumber: upper case, no spaces or hyphens.
UPDATE leads.leads
SET reference_number = upper(regexp_replace(vehicle_registration_number, '[ -]', '', 'g'))
WHERE reference_number IS NULL AND vehicle_registration_number IS NOT NULL;

-- 5. Indexes for the list filter and for customer matching by reference number.
CREATE INDEX IF NOT EXISTS idx_leads_product_type ON leads.leads(tenant_id, product_type_code);
CREATE INDEX IF NOT EXISTS idx_leads_reference_number ON leads.leads(tenant_id, reference_number)
    WHERE reference_number IS NOT NULL;

COMMIT;
