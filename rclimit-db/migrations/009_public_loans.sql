-- Migration 009: Loan Transactions and Disbursal Line Items (public)

CREATE TABLE loan_transactions (
    loan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    serial_number SERIAL,
    loan_number VARCHAR(30),
    lender_agreement_number VARCHAR(50),
    customer_id UUID REFERENCES customers(customer_id),
    vehicle_id UUID REFERENCES vehicles(vehicle_id),
    pool_id UUID REFERENCES master_bank_pools(pool_id),
    partner_id UUID REFERENCES partners(partner_id),
    product_type VARCHAR(30) DEFAULT 'USED_CV',
    sanctioned_amount DECIMAL(15,2) NOT NULL,
    net_disbursed_amount DECIMAL(15,2) NOT NULL,
    customer_rate DECIMAL(5,2) NOT NULL,
    bank_payout_pct_amt DECIMAL(10,2) DEFAULT 0.00,
    bonus_payout_amt DECIMAL(10,2) DEFAULT 0.00,
    shared_payout_amt DECIMAL(10,2) DEFAULT 0.00,
    total_payout_earned DECIMAL(10,2) GENERATED ALWAYS AS (bank_payout_pct_amt + bonus_payout_amt - shared_payout_amt) STORED,
    loan_status VARCHAR(30) DEFAULT 'DISBURSED_RC_PENDING',
    disbursal_date DATE DEFAULT CURRENT_DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_loans_tenant ON loan_transactions(tenant_id);
CREATE INDEX idx_loans_customer ON loan_transactions(customer_id);
CREATE INDEX idx_loans_vehicle ON loan_transactions(vehicle_id);
CREATE INDEX idx_loans_pool ON loan_transactions(pool_id);
CREATE INDEX idx_loans_partner ON loan_transactions(partner_id);
CREATE INDEX idx_loans_status ON loan_transactions(tenant_id, loan_status);

CREATE TABLE disbursal_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loan_transactions(loan_id) ON DELETE CASCADE,
    entry_date DATE DEFAULT CURRENT_DATE,
    particular_type VARCHAR(50) NOT NULL,
    mode_of_payment VARCHAR(20),
    bank_name VARCHAR(100),
    account_no VARCHAR(50),
    transaction_id VARCHAR(100),
    debit_amount DECIMAL(15,2) NOT NULL,
    running_balance_amt DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_disbursal_items_loan ON disbursal_line_items(loan_id);
