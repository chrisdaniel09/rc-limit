-- 005: Partners module. Sub-brokers and DSA agents who refer business. Lives in the partners schema.

CREATE TABLE partners.partners (
    partner_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                    UUID         NOT NULL,
    user_id                      UUID,
    partner_type                 VARCHAR(30)  NOT NULL CHECK (partner_type IN ('SUB_BROKER', 'DSA_AGENT')),
    legal_name                   VARCHAR(150) NOT NULL,
    phone_number                 VARCHAR(20),
    email                        VARCHAR(255),
    default_commission_split_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
    status                       VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    created_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ
);

CREATE INDEX idx_partners_tenant_legal_name ON partners.partners(tenant_id, legal_name, partner_id);
