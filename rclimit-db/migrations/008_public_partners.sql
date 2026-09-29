-- Migration 008: Partners / Sub-Brokers (public)

CREATE TABLE partners (
    partner_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    partner_type VARCHAR(30) CHECK (partner_type IN ('SUB_BROKER', 'DSA_AGENT')),
    legal_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    default_commission_split_pct DECIMAL(5,2) DEFAULT 70.00,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_partners_tenant ON partners(tenant_id);
