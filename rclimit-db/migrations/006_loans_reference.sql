-- 006: Loans module, reference data. Lenders and their bank pools, and the configurable lists used on loans:
-- particular types (ledger debits), counterparties (credit recipients and debit payees) and post-disbursement
-- document statuses.

CREATE TABLE public.lenders (
    lender_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID         NOT NULL,
    name                      VARCHAR(100) NOT NULL,
    code                      VARCHAR(20)  NOT NULL,
    base_interest_rate        NUMERIC(5,2) NOT NULL,
    default_tenure_limit_days INT          NOT NULL DEFAULT 45,
    pdd_sla_days              INT          NOT NULL DEFAULT 45 CHECK (pdd_sla_days > 0),
    contact_person_details    JSONB,
    status                    VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_lenders_tenant_code ON public.lenders(tenant_id, code);

CREATE TABLE public.master_bank_pools (
    pool_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID          NOT NULL,
    lender_id               UUID          NOT NULL REFERENCES public.lenders(lender_id),
    facility_account_number VARCHAR(50)   NOT NULL,
    sanctioned_limit        NUMERIC(15,2) NOT NULL,
    utilized_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sanction_date           DATE,
    expiry_date             DATE,
    status                  VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ
);

CREATE INDEX idx_bank_pools_tenant ON public.master_bank_pools(tenant_id);
CREATE INDEX idx_bank_pools_lender ON public.master_bank_pools(lender_id);

CREATE TABLE public.disbursal_particular_types (
    particular_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID         NOT NULL,
    code               VARCHAR(50)  NOT NULL,
    label              VARCHAR(100) NOT NULL,
    sort_order         INT          NOT NULL DEFAULT 0,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT unique_tenant_particular_code UNIQUE (tenant_id, code)
);

-- Counterparties of ledger entries. The table keeps its original name.
CREATE TABLE public.lender_disbursed_to_options (
    option_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID         NOT NULL,
    code       VARCHAR(50)  NOT NULL,
    label      VARCHAR(100) NOT NULL,
    sort_order INT          NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ix_lender_disbursed_to_options_tenant_code ON public.lender_disbursed_to_options(tenant_id, code);

CREATE TABLE public.post_disbursement_document_statuses (
    document_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID         NOT NULL,
    code               VARCHAR(100) NOT NULL,
    label              VARCHAR(255) NOT NULL,
    sort_order         INT          NOT NULL,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_document_status_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_document_status_active ON public.post_disbursement_document_statuses(tenant_id, is_active);
