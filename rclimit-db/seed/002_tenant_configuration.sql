-- Seed 002: configuration a tenant needs before it can work.
-- Sections 1-5 apply to every tenant in system.tenants. Sections 6-7 (chart of accounts and posting rules)
-- apply to the default tenant.
-- Idempotent: safe to run more than once.
--
-- The particular-type codes INSSRUANCE_PAYMENT, CONVENINECE_FEES and APPROX_FORECLOSER are spelled as in the
-- lender's Excel dropdown (docs/RC_Limit_System_Specification.md). Do not correct them.

-- 1. Application number sequence
INSERT INTO loans.application_number_sequences (tenant_id)
SELECT tenant_id FROM system.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. Lead product types (financial requirements)
INSERT INTO leads.product_types (tenant_id, code, label, sort_order, field_schema, actions)
SELECT t.tenant_id, d.code, d.label, d.sort_order, d.field_schema::jsonb, d.actions::jsonb
FROM system.tenants t
CROSS JOIN (VALUES
    ('USED_CV', 'Used Commercial Vehicle', 1,
     '[{"key":"registration_number","label":"Vehicle registration number","type":"text","required":true,
        "role":"vehicle_registration","validation":{"pattern":"^[A-Za-z]{2}[ -]?[0-9]{1,2}[ -]?[A-Za-z]{0,3}[ -]?[0-9]{4}$"}}]',
     '[{"code":"CIBIL_CHECK","order":1,"config":{}},{"code":"VAHAN_CHECK","order":2,"config":{}}]'),
    ('NEW_CV', 'New Commercial Vehicle', 2,
     '[{"key":"registration_number","label":"Vehicle registration number","type":"text","required":false,
        "role":"vehicle_registration","validation":{"pattern":"^[A-Za-z]{2}[ -]?[0-9]{1,2}[ -]?[A-Za-z]{0,3}[ -]?[0-9]{4}$"}}]',
     '[{"code":"CIBIL_CHECK","order":1,"config":{}},{"code":"VAHAN_CHECK","order":2,"config":{}}]'),
    ('GENERAL_INSURANCE', 'General Insurance', 3, '[]', '[]'),
    ('LIFE_INSURANCE',    'Life Insurance',    4, '[]', '[]'),
    ('OTHER',             'Other',             5, '[]', '[]')
) AS d(code, label, sort_order, field_schema, actions)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3. Ledger counterparties: the recipient of a credit, or the payee of a debit
INSERT INTO loans.lender_disbursed_to_options (tenant_id, code, label, sort_order)
SELECT t.tenant_id, d.code, d.label, d.sort_order
FROM system.tenants t
CROSS JOIN (VALUES
    ('CUSTOMER',     'Customer',     1),
    ('ANNA_FINANCE', 'Anna Finance', 2)
) AS d(code, label, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 4. Particular types for ledger debits
INSERT INTO loans.disbursal_particular_types (tenant_id, code, label, sort_order)
SELECT t.tenant_id, d.code, d.label, d.sort_order
FROM system.tenants t
CROSS JOIN (VALUES
    ('PAYMENT_TO_APPLICANT',     'Payment to Applicant',     1),
    ('PAYMENT_TO_BROKER_SELLER', 'Payment to Broker/Seller', 2),
    ('RTO_CHARGES',              'RTO Charges',              3),
    ('INSSRUANCE_PAYMENT',       'Insurance Payment',        4),
    ('CONVENINECE_FEES',         'Convenience Fees',         5),
    ('APPROX_FORECLOSER',        'Approx Foreclosure',       6),
    ('VALUATION_FEES',           'Valuation Fees',           7),
    ('COMMISSION_PAYOUT',        'Commission Payout',        8)
) AS d(code, label, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 5. Post-disbursement document statuses
INSERT INTO loans.post_disbursement_document_statuses (tenant_id, code, label, sort_order)
SELECT t.tenant_id, d.code, d.label, d.sort_order
FROM system.tenants t
CROSS JOIN (VALUES
    ('RC_RECEIVED',        'RC Received',        1),
    ('INSURANCE_RECEIVED', 'Insurance Received', 2)
) AS d(code, label, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 6. Chart of accounts (default tenant)
INSERT INTO accounting.ledger_accounts (account_id, tenant_id, account_code, account_name, account_type, created_by_user_id) VALUES
    ('acc00001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1010-CASH',     'Master Bank Settlement Account',    'ASSET',     'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1100-DLR-AST',  'Dealer Loan Receivable',            'ASSET',     'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00003-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '2100-BNK-LIAB', 'Lender Bank Pool Debt',             'LIABILITY', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00004-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '4010-FEE-INC',  'Convenience & Handling Fee Income', 'INCOME',    'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '4020-COMM-INC', 'Bank Base Commission Payout',       'INCOME',    'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00006-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '5010-SUB-EXP',  'Shared Sub-Broker Commission',      'EXPENSE',   'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '5020-RTO-EXP',  'RTO Pass-Through Account',          'EXPENSE',   'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('acc00008-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '5030-INS-EXP',  'Insurance Pass-Through Account',    'EXPENSE',   'b2c3d4e5-f6a7-8901-bcde-f12345678901')
ON CONFLICT DO NOTHING;

-- 7. Posting rules (default tenant): the accounts each ledger entry type debits and credits.
--    BANK_DISBURSAL is used for every ledger credit.
INSERT INTO accounting.posting_rules (rule_id, tenant_id, particular_type, debit_account_id, credit_account_id, transaction_type, description) VALUES
    ('a0a00001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'BANK_DISBURSAL',           'acc00002-0000-0000-0000-000000000002', 'acc00003-0000-0000-0000-000000000003', 'BANK_DISBURSAL',     'Bank credit: dealer receivable against bank liability'),
    ('a0a00002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAYMENT_TO_APPLICANT',     'acc00001-0000-0000-0000-000000000001', 'acc00002-0000-0000-0000-000000000002', 'CUSTOMER_DISBURSAL', 'Cash payout to applicant'),
    ('a0a00003-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAYMENT_TO_BROKER_SELLER', 'acc00001-0000-0000-0000-000000000001', 'acc00002-0000-0000-0000-000000000002', 'CUSTOMER_DISBURSAL', 'Cash payout to broker/seller'),
    ('a0a00004-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'RTO_CHARGES',              'acc00007-0000-0000-0000-000000000007', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION',      'RTO charges deducted from disbursal'),
    ('a0a00005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'INSSRUANCE_PAYMENT',       'acc00008-0000-0000-0000-000000000008', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION',      'Insurance premium deducted from disbursal'),
    ('a0a00006-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CONVENINECE_FEES',         'acc00001-0000-0000-0000-000000000001', 'acc00004-0000-0000-0000-000000000004', 'FEE_DEDUCTION',      'Convenience fee retained as income'),
    ('a0a00007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VALUATION_FEES',           'acc00007-0000-0000-0000-000000000007', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION',      'Valuation fees deducted from disbursal'),
    ('a0a00008-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'APPROX_FORECLOSER',        'acc00007-0000-0000-0000-000000000007', 'acc00001-0000-0000-0000-000000000001', 'FEE_DEDUCTION',      'Approx foreclosure amount deducted'),
    ('a0a00009-0000-0000-0000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'COMMISSION_PAYOUT',        'acc00006-0000-0000-0000-000000000006', 'acc00001-0000-0000-0000-000000000001', 'COMMISSION_PAYOUT',  'Sub-broker commission paid out')
ON CONFLICT DO NOTHING;
