-- Migration: Add Lender Disbursed Amount and Lender Disbursed To fields
-- Date: 2026-09-30

-- 1. Add new columns to loan_transactions
ALTER TABLE loan_transactions
    ADD COLUMN lender_disbursed_amount DECIMAL NOT NULL DEFAULT 0;

ALTER TABLE loan_transactions
    ADD COLUMN lender_disbursed_to VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER';

-- 2. Create configurable lookup table for Lender Disbursed To options
CREATE TABLE lender_disbursed_to_options (
    option_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allows_disbursal_line_items BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ix_lender_disbursed_to_options_tenant_code
    ON lender_disbursed_to_options (tenant_id, code);

-- 3. Seed default options (run per tenant, replace <tenant_id> with actual value)
-- INSERT INTO lender_disbursed_to_options (option_id, tenant_id, code, label, sort_order)
-- VALUES
--     (gen_random_uuid(), '<tenant_id>', 'CUSTOMER', 'Customer', 1),
--     (gen_random_uuid(), '<tenant_id>', 'ANNA_FINANCE', 'AnnaFinance', 2);
