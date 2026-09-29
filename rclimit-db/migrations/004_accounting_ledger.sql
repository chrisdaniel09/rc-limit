-- Migration 004: Audited Double-Entry Accounting Schema (accounting)

CREATE TABLE accounting.ledger_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id UUID,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_tenant_account_code UNIQUE (tenant_id, account_code)
);

CREATE INDEX idx_ledger_accounts_tenant ON accounting.ledger_accounts(tenant_id);
CREATE INDEX idx_ledger_accounts_code ON accounting.ledger_accounts(account_code);

CREATE TABLE accounting.journal_entries (
    journal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entry_number SERIAL,
    entry_date DATE DEFAULT CURRENT_DATE,
    reference_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    narration TEXT NOT NULL,
    created_by_user_id UUID NOT NULL,
    posted_by_role VARCHAR(50) NOT NULL,
    source_module VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journal_entries_tenant ON accounting.journal_entries(tenant_id);
CREATE INDEX idx_journal_entries_reference ON accounting.journal_entries(reference_id);
CREATE INDEX idx_journal_entries_date ON accounting.journal_entries(entry_date);

CREATE TABLE accounting.ledger_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID NOT NULL REFERENCES accounting.journal_entries(journal_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounting.ledger_accounts(account_id),
    entry_direction VARCHAR(10) NOT NULL CHECK (entry_direction IN ('DEBIT', 'CREDIT')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_lines_journal ON accounting.ledger_line_items(journal_id);
CREATE INDEX idx_ledger_lines_account ON accounting.ledger_line_items(account_id);
