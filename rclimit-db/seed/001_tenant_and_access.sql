-- Seed 001: the default tenant, the rights catalogue, the SuperAdmin role and the admin user.
-- Idempotent: safe to run more than once.
--
--   Tenant      a1b2c3d4-e5f6-7890-abcd-ef1234567890  Anna Finance
--   Admin user  b2c3d4e5-f6a7-8901-bcde-f12345678901  admin@annafinance.in  (password: Admin@123)
--   SuperAdmin  ffffffff-ffff-ffff-ffff-ffffffffffff

-- 1. Tenant
INSERT INTO system.tenants (tenant_id, organization_name, slug, custom_domain, subscription_plan)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Anna Finance', 'anna-finance', 'ashy-hill-006ad3900.4.azurestaticapps.net', 'ENTERPRISE')
ON CONFLICT DO NOTHING;

INSERT INTO system.tenant_settings (tenant_id, max_active_dealers, allow_whatsapp_intake)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 50, TRUE)
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. Rights catalogue (global)
INSERT INTO auth.rights (code, module, name, description) VALUES
    ('loans.view',       'loans',      'View Loans',        'View loan records and details'),
    ('loans.create',     'loans',      'Create Loans',      'Create new loan files'),
    ('loans.edit',       'loans',      'Edit Loans',        'Move loans through their stages and record ledger entries'),
    ('loans.delete',     'loans',      'Delete Loans',      'Delete loan records'),
    ('customers.view',   'customers',  'View Customers',    'View customer records and details'),
    ('customers.create', 'customers',  'Create Customers',  'Create new customer records'),
    ('customers.edit',   'customers',  'Edit Customers',    'Edit existing customer records'),
    ('customers.delete', 'customers',  'Delete Customers',  'Delete customer records'),
    ('partners.view',    'partners',   'View Partners',     'View partner records and details'),
    ('partners.create',  'partners',   'Create Partners',   'Create new partner records'),
    ('partners.edit',    'partners',   'Edit Partners',     'Edit existing partner records'),
    ('partners.delete',  'partners',   'Delete Partners',   'Delete partner records'),
    ('leads.view',       'leads',      'View Leads',        'View lead records and details'),
    ('leads.create',     'leads',      'Create Leads',      'Create new lead records'),
    ('leads.edit',       'leads',      'Edit Leads',        'Edit existing lead records'),
    ('leads.delete',     'leads',      'Delete Leads',      'Delete lead records'),
    ('leads.product_types.manage', 'leads', 'Manage Lead Product Types', 'Create and edit financial requirements, their fields and their actions'),
    ('accounting.view',   'accounting', 'View Accounting',   'View accounting records and reports'),
    ('accounting.create', 'accounting', 'Create Accounting', 'Create accounting entries'),
    ('accounting.edit',   'accounting', 'Edit Accounting',   'Edit accounting entries'),
    ('accounting.delete', 'accounting', 'Delete Accounting', 'Delete accounting entries'),
    ('dashboard.loan_stats', 'dashboard', 'Dashboard: Loan Stats', 'Show loan summary cards (totals, active, sanctioned, stop-supply dealers)'),
    ('dashboard.rc_aging',   'dashboard', 'Dashboard: RC Aging',   'Show the RC aging alerts widget'),
    ('dashboard.my_leads',   'dashboard', 'Dashboard: My Leads',   'Show the logged-in user''s assigned leads widget'),
    ('users.manage',  'users',  'Manage Users',  'Assign and revoke user roles'),
    ('roles.manage',  'roles',  'Manage Roles',  'Create, edit, delete roles and assign rights'),
    ('rights.manage', 'rights', 'Manage Rights', 'Manage the rights catalogue')
ON CONFLICT (code) DO NOTHING;

-- 3. SuperAdmin role, holding every active right
INSERT INTO auth.roles (role_id, tenant_id, code, name, description, is_system)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SUPER_ADMIN', 'SuperAdmin', 'System administrator with all rights', TRUE)
ON CONFLICT DO NOTHING;

-- Every system role gets every active right, including rights added since the last run.
INSERT INTO auth.role_rights (role_id, right_id)
SELECT r.role_id, rt.right_id
FROM auth.roles r
CROSS JOIN auth.rights rt
WHERE r.is_system AND rt.is_active
ON CONFLICT DO NOTHING;

-- 4. Admin user
INSERT INTO auth.users (user_id, tenant_id, email, phone_number, password_hash, password_salt, full_name)
VALUES (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'admin@annafinance.in',
    '+919876543210',
    'kpo7w8Dhl2EZWdA1fjNFF8ZIg7z9mbnR3gyDJ8diS3k=',
    'fzyIQZI/WIS/aQheMATeoA==',
    'Admin User')
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'ffffffff-ffff-ffff-ffff-ffffffffffff')
ON CONFLICT DO NOTHING;
