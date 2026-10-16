CREATE TABLE post_disbursement_document_statuses (
    document_status_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_document_status_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    CONSTRAINT uk_document_status_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_document_status_tenant ON post_disbursement_document_statuses(tenant_id);
CREATE INDEX idx_document_status_active ON post_disbursement_document_statuses(tenant_id, is_active);

ALTER TABLE loan_transactions
ADD COLUMN post_disbursement_document_status_id UUID;

ALTER TABLE loan_transactions
ADD CONSTRAINT fk_loan_document_status FOREIGN KEY (post_disbursement_document_status_id)
    REFERENCES post_disbursement_document_statuses(document_status_id);
