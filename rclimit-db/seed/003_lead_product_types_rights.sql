-- Rights for managing lead product types (financial requirements).
-- Idempotent: safe to run more than once.

-- 1. Register the right in the catalogue.
INSERT INTO auth.rights (right_id, code, module, name, description, is_active)
SELECT gen_random_uuid(), 'leads.product_types.manage', 'leads', 'Manage Lead Product Types',
       'Create and edit financial requirements, their fields and their actions', TRUE
WHERE NOT EXISTS (SELECT 1 FROM auth.rights WHERE code = 'leads.product_types.manage');

-- 2. Grant it to every system role (SuperAdmin). Other roles get it from an admin.
INSERT INTO auth.role_rights (role_id, right_id)
SELECT r.role_id, rt.right_id
FROM auth.roles r
CROSS JOIN auth.rights rt
WHERE r.is_system = TRUE
  AND rt.code = 'leads.product_types.manage'
ON CONFLICT DO NOTHING;
