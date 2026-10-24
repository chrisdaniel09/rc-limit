-- Default lead product types for every tenant in system.tenants.
-- Migration 029 seeds existing tenants. This file covers tenants created afterwards by the seed scripts.
-- Idempotent: safe to run more than once.

INSERT INTO leads.product_types
    (tenant_id, code, label, sort_order, field_schema, actions)
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
