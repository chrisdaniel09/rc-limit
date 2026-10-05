-- Migration 018: Leads Module Enhancements
-- Date: 2026-10-05

-- 1. Add new columns to leads table for assignment, checks and conversion
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(user_id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cibil_check_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cibil_checked_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rc_check_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rc_checked_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_customer_id UUID REFERENCES customers(customer_id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- 2. Update lead_status default and backfill existing leads
UPDATE leads SET lead_status = 'NEW' WHERE lead_status = 'INBOUND_INCOMPLETE';
ALTER TABLE leads ALTER COLUMN lead_status SET DEFAULT 'NEW';

-- 3. Create lead check logs table for audit trail and future integration
CREATE TABLE IF NOT EXISTS lead_check_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system.tenants(tenant_id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    check_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    score INT,
    remarks TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    performed_by_user_id UUID NOT NULL REFERENCES auth.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_check_logs_lead_id ON lead_check_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_check_logs_tenant_id ON lead_check_logs(tenant_id);

-- 4. Add index for assignment queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(tenant_id, assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
