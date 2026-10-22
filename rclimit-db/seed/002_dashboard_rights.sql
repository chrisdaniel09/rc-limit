-- Dashboard widget rights
-- Each dashboard widget is gated by its own right so admins can map widgets to roles.
-- Idempotent: safe to run more than once.

-- 1. Register the widget rights in the catalogue
INSERT INTO auth.rights (right_id, code, module, name, description, is_active)
VALUES
    (gen_random_uuid(), 'dashboard.loan_stats', 'dashboard', 'Dashboard: Loan Stats', 'Show loan summary cards (totals, active, sanctioned, stop-supply dealers)', TRUE),
    (gen_random_uuid(), 'dashboard.rc_aging', 'dashboard', 'Dashboard: RC Aging', 'Show the RC aging alerts widget', TRUE),
    (gen_random_uuid(), 'dashboard.my_leads', 'dashboard', 'Dashboard: My Leads', 'Show the logged-in user''s assigned leads widget', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Grant the widget rights to every system role (SuperAdmin).
--    Non-system roles are intentionally NOT granted here; admins assign them per role.
INSERT INTO auth.role_rights (role_id, right_id)
SELECT r.role_id, rt.right_id
FROM auth.roles r
CROSS JOIN auth.rights rt
WHERE r.is_system = TRUE
  AND rt.module = 'dashboard'
ON CONFLICT DO NOTHING;
