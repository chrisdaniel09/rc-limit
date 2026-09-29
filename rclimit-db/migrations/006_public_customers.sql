-- Migration 006: Customers and Sub-Limits (public)

CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    customer_type VARCHAR(20) CHECK (customer_type IN ('DEALER', 'INDIVIDUAL')),
    legal_name VARCHAR(150) NOT NULL,
    trade_name VARCHAR(150),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    pan_number VARCHAR(20),
    gstin VARCHAR(20),
    cibil_score INT,
    cibil_tier VARCHAR(10) CHECK (cibil_tier IN ('GREEN', 'AMBER', 'RED')),
    kyc_status VARCHAR(20) DEFAULT 'PENDING',
    risk_status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_type ON customers(tenant_id, customer_type);

CREATE TABLE customer_sub_limits (
    sub_limit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    assigned_ceiling DECIMAL(15,2) NOT NULL,
    current_utilization DECIMAL(15,2) DEFAULT 0.00,
    pending_rc_count INT DEFAULT 0,
    max_pending_rc_allowed INT DEFAULT 5,
    stop_supply_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_sub_limits_customer ON customer_sub_limits(customer_id);
