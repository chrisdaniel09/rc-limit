-- Seed Data for RCLimit Development Environment

-- 1. Default Tenant
INSERT INTO system.tenants (tenant_id, organization_name, slug, subscription_plan)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Anna Finance', 'anna-finance', 'ENTERPRISE');

INSERT INTO system.tenant_settings (tenant_id, max_active_dealers, allow_whatsapp_intake)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 50, TRUE);

-- 2. Admin User (password: Admin@123)
INSERT INTO auth.users (user_id, tenant_id, email, phone_number, password_hash, password_salt, full_name, is_active)
VALUES (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'admin@annafinance.in',
    '+919876543210',
    'kpo7w8Dhl2EZWdA1fjNFF8ZIg7z9mbnR3gyDJ8diS3k=',
    'fzyIQZI/WIS/aQheMATeoA==',
    'Admin User',
    TRUE
);

-- 3. Sample Lenders
INSERT INTO lenders (lender_id, tenant_id, name, code, base_interest_rate, default_tenure_limit_days, status) VALUES
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chola', 'CHOLA_CV', 11.00, 45, 'ACTIVE'),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'HDFC Bank', 'HDFC_CV', 10.50, 30, 'ACTIVE'),
('e5f6a7b8-c9d0-1234-efab-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ICICI Bank', 'ICICI_CV', 10.75, 45, 'ACTIVE'),
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sundaram Finance', 'SUNDARAM_CV', 11.25, 45, 'ACTIVE'),
('a7b8c9d0-e1f2-3456-abcd-567890123456', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Shriram Finance', 'SHRIRAM_CV', 11.50, 60, 'ACTIVE');

-- 4. Sample Bank Pools
INSERT INTO master_bank_pools (pool_id, tenant_id, lender_id, facility_account_number, sanctioned_limit, utilized_amount, status) VALUES
('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'CHOLA-FAC-2026-001', 50000000.00, 12500000.00, 'ACTIVE'),
('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 'HDFC-FAC-2026-001', 30000000.00, 8000000.00, 'ACTIVE'),
('33333333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 'ICICI-FAC-2026-001', 40000000.00, 15000000.00, 'ACTIVE');

-- 5. Sample Partners
INSERT INTO partners (partner_id, tenant_id, partner_type, legal_name, phone_number, default_commission_split_pct, status) VALUES
('44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SUB_BROKER', 'Rajesh Patel Automobiles', '+919812345001', 70.00, 'ACTIVE'),
('55555555-5555-5555-5555-555555555555', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DSA_AGENT', 'Mehul Shah Motors', '+919812345002', 60.00, 'ACTIVE');

-- 6. Sample Customers (Dealers)
INSERT INTO customers (customer_id, tenant_id, customer_type, legal_name, trade_name, phone_number, cibil_score, cibil_tier, risk_status) VALUES
('66666666-6666-6666-6666-666666666666', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DEALER', 'Jiva Wasim Mehmud', 'Apex Motors', '+919812345003', 740, 'GREEN', 'ACTIVE'),
('77777777-7777-7777-7777-777777777777', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DEALER', 'Vikram Singh Rajput', 'Royal CV Trading', '+919812345004', 680, 'AMBER', 'ACTIVE'),
('88888888-8888-8888-8888-888888888888', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'INDIVIDUAL', 'Amit Kumar Sharma', NULL, '+919812345005', 760, 'GREEN', 'ACTIVE');

-- 7. Customer Sub-Limits
INSERT INTO customer_sub_limits (customer_id, assigned_ceiling, current_utilization, pending_rc_count, max_pending_rc_allowed, stop_supply_flag) VALUES
('66666666-6666-6666-6666-666666666666', 5000000.00, 1519490.00, 1, 5, FALSE),
('77777777-7777-7777-7777-777777777777', 3000000.00, 2800000.00, 4, 5, FALSE),
('88888888-8888-8888-8888-888888888888', 1000000.00, 0.00, 0, 3, FALSE);

-- 8. Sample Vehicles
INSERT INTO vehicles (vehicle_id, tenant_id, registration_number, make, model, year_of_mfg, current_rto_status) VALUES
('aaaa1111-aaaa-1111-aaaa-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'GJ05BX6637', 'Tata', 'Prima 2830.K', 2022, 'CLEAN'),
('aaaa2222-aaaa-2222-aaaa-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'GJ06CY7748', 'Ashok Leyland', 'Captain 2523', 2021, 'CLEAN'),
('aaaa3333-aaaa-3333-aaaa-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'MH04DZ8859', 'BharatBenz', '1617R', 2023, 'HYPOTHECATED');

-- 9. Sample Loan Transaction
INSERT INTO loan_transactions (loan_id, tenant_id, loan_number, lender_agreement_number, customer_id, vehicle_id, pool_id, partner_id, product_type, sanctioned_amount, net_disbursed_amount, customer_rate, bank_payout_pct_amt, bonus_payout_amt, shared_payout_amt, loan_status, disbursal_date, remarks) VALUES
('bbbb1111-bbbb-1111-bbbb-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'LN-2026-0001', 'CHOLA-AGR-0089', '66666666-6666-6666-6666-666666666666', 'aaaa1111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'USED_CV', 1519490.00, 1476201.00, 12.50, 15000.00, 5000.00, 6000.00, 'DISBURSED_RC_PENDING', '2026-03-28', 'First sample loan');

-- 10. Sample Disbursal Line Items
INSERT INTO disbursal_line_items (loan_id, entry_date, particular_type, mode_of_payment, bank_name, account_no, transaction_id, debit_amount, running_balance_amt) VALUES
('bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'RTO_CHARGES', 'NEFT', 'SBI', '12345678901', 'UTR001', 8500.00, 1510990.00),
('bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'INSSRUANCE_PAYMENT', 'NEFT', 'ICICI', '98765432101', 'UTR002', 22000.00, 1488990.00),
('bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'VALUATION_FEES', 'CASH', NULL, NULL, NULL, 3500.00, 1485490.00),
('bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'CONVENINECE_FEES', 'INTERNAL_TRANSFER', NULL, NULL, NULL, 9289.00, 1476201.00);

-- 11. RC Pipeline Tracker for sample loan
INSERT INTO rc_pipeline_tracker (loan_id, current_stage, aging_status)
VALUES ('bbbb1111-bbbb-1111-bbbb-111111111111', 'DISBURSED_PENDING_RTO', 'ON_TIME');

-- 12. Sample Accounting Ledger Accounts
INSERT INTO accounting.ledger_accounts (account_id, tenant_id, account_code, account_name, account_type, created_by_user_id) VALUES
('acc00001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1010-CASH', 'Master Bank Settlement Account', 'ASSET', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1100-DLR-AST', 'Dealer Loan Receivable', 'ASSET', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00003-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '2100-BNK-LIAB', 'Lender Bank Pool Debt', 'LIABILITY', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00004-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '4010-FEE-INC', 'Convenience & Handling Fee Income', 'INCOME', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '4020-COMM-INC', 'Bank Base Commission Payout', 'INCOME', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00006-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '5010-SUB-EXP', 'Shared Sub-Broker Commission', 'EXPENSE', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '5020-RTO-EXP', 'RTO Pass-Through Account', 'EXPENSE', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
('acc00008-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '5030-INS-EXP', 'Insurance Pass-Through Account', 'EXPENSE', 'b2c3d4e5-f6a7-8901-bcde-f12345678901');

-- 8. Default Posting Rules (account mapping for automated journal entries)
INSERT INTO accounting.posting_rules (rule_id, tenant_id, particular_type, debit_account_id, credit_account_id, transaction_type, description) VALUES
('a0a00001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'BANK_DISBURSAL', 'acc00002-0000-0000-0000-000000000002', 'acc00003-0000-0000-0000-000000000003', 'BANK_DISBURSAL', 'Loan sanctioned — Dealer receivable vs Bank liability'),
('a0a00002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAYMENT_TO_APPLICANT', 'acc00001-0000-0000-0000-000000000001', 'acc00002-0000-0000-0000-000000000002', 'CUSTOMER_DISBURSAL', 'Cash payout to applicant'),
('a0a00003-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAYMENT_TO_BROKER_SELLER', 'acc00001-0000-0000-0000-000000000001', 'acc00002-0000-0000-0000-000000000002', 'CUSTOMER_DISBURSAL', 'Cash payout to broker/seller'),
('a0a00004-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'RTO_CHARGES', 'acc00007-0000-0000-0000-000000000007', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION', 'RTO charges deducted from disbursal'),
('a0a00005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'INSSRUANCE_PAYMENT', 'acc00008-0000-0000-0000-000000000008', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION', 'Insurance premium deducted from disbursal'),
('a0a00006-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CONVENINECE_FEES', 'acc00001-0000-0000-0000-000000000001', 'acc00004-0000-0000-0000-000000000004', 'FEE_DEDUCTION', 'Convenience fee retained as income'),
('a0a00007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VALUATION_FEES', 'acc00007-0000-0000-0000-000000000007', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION', 'Valuation fees deducted from disbursal'),
('a0a00008-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'APPROX_FORECLOSER', 'acc00007-0000-0000-0000-000000000007', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION', 'Approx foreclosure amount deducted'),
('a0a00009-0000-0000-0000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'COMMISSION_PAYOUT', 'acc00006-0000-0000-0000-000000000006', 'acc00001-0000-0000-0000-000000000001', 'COMMISSION_PAYOUT', 'Sub-broker commission paid out');

-- 9. Default Disbursal Particular Types
INSERT INTO disbursal_particular_types (particular_type_id, tenant_id, code, label, sort_order) VALUES
('d1a00001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAYMENT_TO_APPLICANT', 'Payment to Applicant', 1),
('d1a00002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAYMENT_TO_BROKER_SELLER', 'Payment to Broker/Seller', 2),
('d1a00003-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'RTO_CHARGES', 'RTO Charges', 3),
('d1a00004-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'INSSRUANCE_PAYMENT', 'Insurance Payment', 4),
('d1a00005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CONVENINECE_FEES', 'Convenience Fees', 5),
('d1a00006-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'APPROX_FORECLOSER', 'Approx Foreclosure', 6),
('d1a00007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VALUATION_FEES', 'Valuation Fees', 7),
('d1a00008-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'COMMISSION_PAYOUT', 'Commission Payout', 8);
