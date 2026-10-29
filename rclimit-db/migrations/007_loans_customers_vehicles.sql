-- 007: Loans module, customers and vehicles. Customers with their sub-limits, vehicles with their ownership
-- history, verification logs, and comments on customers and loans.

CREATE TABLE loans.customers (
    customer_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID         NOT NULL,
    user_id      UUID,
    customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('DEALER', 'INDIVIDUAL')),
    legal_name   VARCHAR(150) NOT NULL,
    trade_name   VARCHAR(150),
    phone_number VARCHAR(20),
    email        VARCHAR(255),
    pan_number   VARCHAR(20),
    gstin        VARCHAR(20),
    cibil_score  INT,
    cibil_tier   VARCHAR(10)  CHECK (cibil_tier IN ('GREEN', 'AMBER', 'RED')),
    kyc_status   VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    risk_status  VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ
);

CREATE INDEX idx_customers_tenant_legal_name ON loans.customers(tenant_id, legal_name, customer_id);
CREATE INDEX idx_customers_type ON loans.customers(tenant_id, customer_type);

-- The customer's revolving limit. Utilization moves at disbursal and closure.
CREATE TABLE loans.customer_sub_limits (
    sub_limit_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id            UUID          NOT NULL REFERENCES loans.customers(customer_id) ON DELETE CASCADE,
    assigned_ceiling       NUMERIC(15,2) NOT NULL,
    current_utilization    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    pending_rc_count       INT           NOT NULL DEFAULT 0,
    max_pending_rc_allowed INT           NOT NULL DEFAULT 5,
    stop_supply_flag       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ
);

CREATE INDEX idx_sub_limits_customer ON loans.customer_sub_limits(customer_id);

CREATE TABLE loans.vehicles (
    vehicle_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL,
    registration_number VARCHAR(20) NOT NULL,
    chassis_number      VARCHAR(50),
    engine_number       VARCHAR(50),
    make                VARCHAR(50),
    model               VARCHAR(50),
    variant             VARCHAR(50),
    year_of_mfg         INT,
    ownership_count     INT         NOT NULL DEFAULT 1,
    current_rto_status  VARCHAR(30) NOT NULL DEFAULT 'CLEAN',
    owner_customer_id   UUID REFERENCES loans.customers(customer_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ
);

CREATE INDEX idx_vehicles_tenant ON loans.vehicles(tenant_id);
CREATE INDEX idx_vehicles_reg ON loans.vehicles(registration_number);
CREATE INDEX idx_vehicles_owner ON loans.vehicles(owner_customer_id);

-- Ownership history. At most one open row (owned_to IS NULL) per vehicle.
-- source_lead_id is a plain id: leads belong to the Leads module.
CREATE TABLE loans.customer_vehicles (
    customer_vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL,
    customer_id         UUID        NOT NULL REFERENCES loans.customers(customer_id),
    vehicle_id          UUID        NOT NULL REFERENCES loans.vehicles(vehicle_id),
    source_lead_id      UUID,
    owned_from          TIMESTAMPTZ NOT NULL DEFAULT now(),
    owned_to            TIMESTAMPTZ,
    end_reason          VARCHAR(50)
);

CREATE INDEX idx_customer_vehicles_tenant ON loans.customer_vehicles(tenant_id);
CREATE INDEX idx_customer_vehicles_customer ON loans.customer_vehicles(customer_id);
CREATE INDEX idx_customer_vehicles_vehicle ON loans.customer_vehicles(vehicle_id);
CREATE UNIQUE INDEX uk_customer_vehicles_open ON loans.customer_vehicles(vehicle_id) WHERE owned_to IS NULL;

CREATE TABLE loans.verification_logs (
    verification_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID        NOT NULL,
    vehicle_id        UUID,
    customer_id       UUID,
    verification_type VARCHAR(30) NOT NULL,
    request_payload   JSONB,
    response_payload  JSONB,
    result_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    executed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_tenant ON loans.verification_logs(tenant_id);
CREATE INDEX idx_verification_vehicle ON loans.verification_logs(vehicle_id);
CREATE INDEX idx_verification_customer ON loans.verification_logs(customer_id);

-- Comments on customers and loans. Lead comments live in leads.lead_comments.
CREATE TABLE loans.entity_comments (
    comment_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID        NOT NULL,
    entity_type        VARCHAR(30) NOT NULL CONSTRAINT entity_type_check CHECK (entity_type IN ('CUSTOMER', 'LOAN')),
    entity_id          UUID        NOT NULL,
    comment_text       TEXT        NOT NULL,
    created_by_user_id UUID        NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_comments_entity ON loans.entity_comments(tenant_id, entity_type, entity_id, created_at DESC);
