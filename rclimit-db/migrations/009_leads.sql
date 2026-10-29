-- 009: Leads module. Product types (financial requirements), leads, their action runs, links to customers,
-- and comments. Customers belong to the Loans module, so customer ids are plain ids.

-- Each product type defines the fields captured on a lead and the actions (checks) run on it.
CREATE TABLE leads.product_types (
    product_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL,
    code            VARCHAR(30)  NOT NULL,
    label           VARCHAR(100) NOT NULL,
    sort_order      INT          NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    field_schema    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    actions         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_types_tenant_code UNIQUE (tenant_id, code)
);

-- The vehicle and CIBIL/RC check columns are legacy fields still read by the backend.
-- Product-specific values live in product_details.
CREATE TABLE leads.leads (
    lead_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID         NOT NULL,
    lead_source                 VARCHAR(30)  NOT NULL DEFAULT 'WHATSAPP_BOT',
    partner_id                  UUID,
    referred_by_user_id         UUID,
    whatsapp_phone_number       VARCHAR(20)  NOT NULL,
    contact_phone               VARCHAR(20),
    applicant_name              VARCHAR(150),
    product_type_code           VARCHAR(30)  NOT NULL DEFAULT 'USED_CV',
    product_details             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    reference_number            VARCHAR(30),
    lead_status                 VARCHAR(30)  NOT NULL DEFAULT 'NEW',
    notes                       TEXT,
    assigned_to_user_id         UUID,
    assigned_at                 TIMESTAMPTZ,
    converted_customer_id       UUID,
    converted_at                TIMESTAMPTZ,
    requested_loan_amount       NUMERIC(15,2),
    vehicle_registration_number VARCHAR(20),
    vahan_validation_status     VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
    cibil_score_preview         INT,
    cibil_check_status          VARCHAR(20)  NOT NULL DEFAULT 'NOT_STARTED',
    cibil_checked_at            TIMESTAMPTZ,
    rc_check_status             VARCHAR(20)  NOT NULL DEFAULT 'NOT_STARTED',
    rc_checked_at               TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ
);

CREATE INDEX idx_leads_tenant_created ON leads.leads(tenant_id, created_at DESC, lead_id);
CREATE INDEX idx_leads_status ON leads.leads(tenant_id, lead_status);
CREATE INDEX idx_leads_product_type ON leads.leads(tenant_id, product_type_code);
CREATE INDEX idx_leads_reference_number ON leads.leads(tenant_id, reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX idx_leads_assigned_to ON leads.leads(tenant_id, assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_leads_referred_by ON leads.leads(referred_by_user_id);

-- One row per run of an action. status is the run lifecycle; the outcome is in response_payload.
CREATE TABLE leads.action_executions (
    execution_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL,
    lead_id              UUID        NOT NULL REFERENCES leads.leads(lead_id) ON DELETE CASCADE,
    product_type_code    VARCHAR(30) NOT NULL,
    action_code          VARCHAR(50) NOT NULL,
    action_order         INT,
    status               VARCHAR(20) NOT NULL,
    source               VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    request_payload      JSONB,
    response_payload     JSONB,
    error_message        TEXT,
    performed_by_user_id UUID,
    started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at         TIMESTAMPTZ
);

CREATE INDEX idx_action_executions_lead_action ON leads.action_executions(tenant_id, lead_id, action_code, started_at DESC);

-- Legacy CIBIL and RC check log, still read by the backend.
CREATE TABLE leads.lead_check_logs (
    log_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL,
    lead_id              UUID        NOT NULL REFERENCES leads.leads(lead_id) ON DELETE CASCADE,
    check_type           VARCHAR(20) NOT NULL,
    status               VARCHAR(20) NOT NULL,
    score                INT,
    remarks              TEXT,
    source               VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    performed_by_user_id UUID        NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_check_logs_lead_id ON leads.lead_check_logs(lead_id);
CREATE INDEX idx_lead_check_logs_tenant_id ON leads.lead_check_logs(tenant_id);

-- The customer a lead was converted into (one per lead).
CREATE TABLE leads.lead_customers (
    lead_customer_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID        NOT NULL,
    lead_id           UUID        NOT NULL UNIQUE REFERENCES leads.leads(lead_id),
    customer_id       UUID        NOT NULL,
    link_type         VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    match_basis       VARCHAR(50),
    linked_by_user_id UUID,
    linked_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_customers_customer ON leads.lead_customers(customer_id);
CREATE INDEX idx_lead_customers_linked_at ON leads.lead_customers(tenant_id, linked_at DESC);

CREATE TABLE leads.lead_comments (
    comment_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID        NOT NULL,
    lead_id            UUID        NOT NULL REFERENCES leads.leads(lead_id) ON DELETE CASCADE,
    comment_text       TEXT        NOT NULL,
    created_by_user_id UUID        NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_comments_lead ON leads.lead_comments(tenant_id, lead_id, created_at DESC);
