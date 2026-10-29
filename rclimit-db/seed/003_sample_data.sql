-- Seed 003: sample data for development. Skip it for any real environment (run_migrations.ps1 -NoSampleData).
-- Idempotent: safe to run more than once.
--
-- The figures agree with each other:
--   * Each vehicle has an owner, so a loan can be raised against it.
--   * Loan APP-2026-000001 is disbursed: the bank credited Anna Finance, four deductions followed, and the
--     balance is 14,76,201. Its customer's sub-limit and its pool show the sanctioned amount as used.
--   * Loan APP-2026-000002 is in credit review, ready to be sanctioned.

-- 1. Lenders and bank pools
INSERT INTO public.lenders (lender_id, tenant_id, name, code, base_interest_rate, default_tenure_limit_days, pdd_sla_days) VALUES
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chola',            'CHOLA_CV',    11.00, 45, 45),
    ('d4e5f6a7-b8c9-0123-defa-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'HDFC Bank',        'HDFC_CV',     10.50, 30, 30),
    ('e5f6a7b8-c9d0-1234-efab-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ICICI Bank',       'ICICI_CV',    10.75, 45, 45),
    ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sundaram Finance', 'SUNDARAM_CV', 11.25, 45, 45),
    ('a7b8c9d0-e1f2-3456-abcd-567890123456', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Shriram Finance',  'SHRIRAM_CV',  11.50, 60, 45)
ON CONFLICT DO NOTHING;

INSERT INTO public.master_bank_pools (pool_id, tenant_id, lender_id, facility_account_number, sanctioned_limit, utilized_amount) VALUES
    ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'CHOLA-FAC-2026-001', 50000000.00, 1519490.00),
    ('22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 'HDFC-FAC-2026-001',  30000000.00, 0.00),
    ('33333333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-345678901234', 'ICICI-FAC-2026-001', 40000000.00, 0.00)
ON CONFLICT DO NOTHING;

-- 2. Partners
INSERT INTO public.partners (partner_id, tenant_id, partner_type, legal_name, phone_number, default_commission_split_pct) VALUES
    ('44444444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SUB_BROKER', 'Rajesh Patel Automobiles', '+919812345001', 70.00),
    ('55555555-5555-5555-5555-555555555555', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DSA_AGENT',  'Mehul Shah Motors',        '+919812345002', 60.00)
ON CONFLICT DO NOTHING;

-- 3. Customers and their sub-limits
INSERT INTO public.customers (customer_id, tenant_id, customer_type, legal_name, trade_name, phone_number, cibil_score, cibil_tier) VALUES
    ('66666666-6666-6666-6666-666666666666', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DEALER',     'Jiva Wasim Mehmud',   'Apex Motors',      '+919812345003', 740, 'GREEN'),
    ('77777777-7777-7777-7777-777777777777', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DEALER',     'Vikram Singh Rajput', 'Royal CV Trading', '+919812345004', 680, 'AMBER'),
    ('88888888-8888-8888-8888-888888888888', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'INDIVIDUAL', 'Amit Kumar Sharma',   NULL,               '+919812345005', 760, 'GREEN')
ON CONFLICT DO NOTHING;

INSERT INTO public.customer_sub_limits (sub_limit_id, customer_id, assigned_ceiling, current_utilization, pending_rc_count, max_pending_rc_allowed) VALUES
    ('5b000001-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 5000000.00, 1519490.00, 1, 5),
    ('5b000002-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', 3000000.00, 0.00,       0, 5),
    ('5b000003-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', 1000000.00, 0.00,       0, 3)
ON CONFLICT DO NOTHING;

-- 4. Vehicles, each owned by a customer, with the matching open ownership row
INSERT INTO public.vehicles (vehicle_id, tenant_id, registration_number, make, model, year_of_mfg, current_rto_status, owner_customer_id) VALUES
    ('aaaa1111-aaaa-1111-aaaa-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'GJ05BX6637', 'Tata',          'Prima 2830.K', 2022, 'CLEAN',        '66666666-6666-6666-6666-666666666666'),
    ('aaaa2222-aaaa-2222-aaaa-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'GJ06CY7748', 'Ashok Leyland', 'Captain 2523', 2021, 'CLEAN',        '77777777-7777-7777-7777-777777777777'),
    ('aaaa3333-aaaa-3333-aaaa-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'MH04DZ8859', 'BharatBenz',    '1617R',        2023, 'HYPOTHECATED', '88888888-8888-8888-8888-888888888888')
ON CONFLICT DO NOTHING;

INSERT INTO public.customer_vehicles (tenant_id, customer_id, vehicle_id, owned_from)
SELECT v.tenant_id, v.owner_customer_id, v.vehicle_id, v.created_at
FROM public.vehicles v
WHERE v.owner_customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.customer_vehicles cv WHERE cv.vehicle_id = v.vehicle_id AND cv.owned_to IS NULL);

-- 5. Loans
INSERT INTO public.loan_transactions (
    loan_id, tenant_id, application_number, lender_agreement_number, customer_id, vehicle_id, pool_id, partner_id,
    product_type, loan_status, requested_amount, sanctioned_amount, tenure_months, customer_rate, net_disbursed_amount,
    bank_payout_pct_amt, bonus_payout_amt, shared_payout_amt,
    logged_in_date, sanction_date, disbursal_date, emi_start_date, emi_due_day, pdd_due_date, remarks, created_by_user_id)
VALUES
    ('bbbb1111-bbbb-1111-bbbb-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'APP-2026-000001', 'CHOLA-AGR-0089',
     '66666666-6666-6666-6666-666666666666', 'aaaa1111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
     'USED_CV', 'DISBURSED', 1519490.00, 1519490.00, 36, 12.50, 1476201.00,
     15000.00, 5000.00, 6000.00,
     '2026-03-20', '2026-03-25', '2026-03-28', '2026-05-05', 5, '2026-05-12', 'First sample loan', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
    ('bbbb2222-bbbb-2222-bbbb-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'APP-2026-000002', NULL,
     '88888888-8888-8888-8888-888888888888', 'aaaa3333-aaaa-3333-aaaa-333333333333', '33333333-3333-3333-3333-333333333333', NULL,
     'USED_CV', 'CREDIT_REVIEW', 800000.00, NULL, NULL, 0.00, 0.00,
     0.00, 0.00, 0.00,
     '2026-10-20', NULL, NULL, NULL, NULL, NULL, 'Awaiting sanction', 'b2c3d4e5-f6a7-8901-bcde-f12345678901')
ON CONFLICT DO NOTHING;

-- The next application number follows the sample loans.
UPDATE public.application_number_sequences
SET next_value = GREATEST(next_value, 3)
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 6. Ledger of the disbursed loan: the bank's credit to Anna Finance, then the deductions from it.
--    created_at is explicit so the entries keep their order.
INSERT INTO public.disbursal_line_items (line_item_id, loan_id, entry_date, entry_direction, counterparty, particular_type, mode_of_payment, bank_name, account_no, transaction_id, amount, running_balance_amt, created_by_user_id, created_at) VALUES
    ('d0000001-0000-0000-0000-000000000001', 'bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'CREDIT', 'ANNA_FINANCE', 'BANK_DISBURSAL',     'NEFT',              'CHOLA', NULL,          'UTR000', 1519490.00, 1519490.00, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '2026-03-28 10:00:00+05:30'),
    ('d0000002-0000-0000-0000-000000000002', 'bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'DEBIT',  'ANNA_FINANCE', 'RTO_CHARGES',        'NEFT',              'SBI',   '12345678901', 'UTR001',    8500.00, 1510990.00, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '2026-03-28 10:01:00+05:30'),
    ('d0000003-0000-0000-0000-000000000003', 'bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'DEBIT',  'ANNA_FINANCE', 'INSSRUANCE_PAYMENT', 'NEFT',              'ICICI', '98765432101', 'UTR002',   22000.00, 1488990.00, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '2026-03-28 10:02:00+05:30'),
    ('d0000004-0000-0000-0000-000000000004', 'bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'DEBIT',  'ANNA_FINANCE', 'VALUATION_FEES',     'CASH',              NULL,    NULL,          NULL,        3500.00, 1485490.00, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '2026-03-28 10:03:00+05:30'),
    ('d0000005-0000-0000-0000-000000000005', 'bbbb1111-bbbb-1111-bbbb-111111111111', '2026-03-28', 'DEBIT',  'ANNA_FINANCE', 'CONVENINECE_FEES',   'INTERNAL_TRANSFER', NULL,    NULL,          NULL,        9289.00, 1476201.00, 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '2026-03-28 10:04:00+05:30')
ON CONFLICT DO NOTHING;

-- 7. RC tracker of the disbursed loan
INSERT INTO public.rc_pipeline_tracker (loan_id, current_stage, aging_status)
VALUES ('bbbb1111-bbbb-1111-bbbb-111111111111', 'DISBURSED_PENDING_RTO', 'ON_TIME')
ON CONFLICT (loan_id) DO NOTHING;
