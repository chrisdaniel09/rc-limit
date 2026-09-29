CREATE TABLE accounting.posting_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    particular_type VARCHAR(50) NOT NULL,
    debit_account_id UUID NOT NULL REFERENCES accounting.ledger_accounts(account_id),
    credit_account_id UUID NOT NULL REFERENCES accounting.ledger_accounts(account_id),
    transaction_type VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_tenant_particular UNIQUE (tenant_id, particular_type)
);

CREATE INDEX idx_posting_rules_tenant ON accounting.posting_rules(tenant_id);
