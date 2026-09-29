-- Migration 005: Lenders and Master Bank Pools (public)

CREATE TABLE lenders (
    lender_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    base_interest_rate DECIMAL(5,2) NOT NULL,
    default_tenure_limit_days INT NOT NULL DEFAULT 45,
    contact_person_details JSONB,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_lenders_tenant ON lenders(tenant_id);
CREATE UNIQUE INDEX idx_lenders_tenant_code ON lenders(tenant_id, code);

CREATE TABLE master_bank_pools (
    pool_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    lender_id UUID NOT NULL REFERENCES lenders(lender_id),
    facility_account_number VARCHAR(50) NOT NULL,
    sanctioned_limit DECIMAL(15,2) NOT NULL,
    utilized_amount DECIMAL(15,2) DEFAULT 0.00,
    sanction_date DATE,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_bank_pools_tenant ON master_bank_pools(tenant_id);
CREATE INDEX idx_bank_pools_lender ON master_bank_pools(lender_id);
