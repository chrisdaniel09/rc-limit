-- Migration: Add roles and rights (RBAC)
-- Date: 2026-10-05

-- 1. Create rights catalogue (global, not tenant-scoped)
CREATE TABLE IF NOT EXISTS auth.rights (
    right_id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Create roles (tenant-scoped)
CREATE TABLE IF NOT EXISTS auth.roles (
    role_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code),
    CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES auth.tenants(tenant_id)
);

CREATE INDEX IF NOT EXISTS ix_roles_tenant_id ON auth.roles(tenant_id);

-- 3. Join: roles to rights
CREATE TABLE IF NOT EXISTS auth.role_rights (
    role_id UUID NOT NULL,
    right_id UUID NOT NULL,
    PRIMARY KEY (role_id, right_id),
    CONSTRAINT fk_role_rights_role FOREIGN KEY (role_id) REFERENCES auth.roles(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_role_rights_right FOREIGN KEY (right_id) REFERENCES auth.rights(right_id) ON DELETE CASCADE
);

-- 4. Join: users to roles
CREATE TABLE IF NOT EXISTS auth.user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES auth.roles(role_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON auth.user_roles(user_id);

-- 5. Seed rights catalogue (global, run once)
INSERT INTO auth.rights (right_id, code, module, name, description, is_active)
VALUES
    (gen_random_uuid(), 'loans.view', 'loans', 'View Loans', 'View loan records and details', TRUE),
    (gen_random_uuid(), 'loans.create', 'loans', 'Create Loans', 'Create new loan records', TRUE),
    (gen_random_uuid(), 'loans.edit', 'loans', 'Edit Loans', 'Edit existing loan records', TRUE),
    (gen_random_uuid(), 'loans.delete', 'loans', 'Delete Loans', 'Delete loan records', TRUE),
    (gen_random_uuid(), 'customers.view', 'customers', 'View Customers', 'View customer records and details', TRUE),
    (gen_random_uuid(), 'customers.create', 'customers', 'Create Customers', 'Create new customer records', TRUE),
    (gen_random_uuid(), 'customers.edit', 'customers', 'Edit Customers', 'Edit existing customer records', TRUE),
    (gen_random_uuid(), 'customers.delete', 'customers', 'Delete Customers', 'Delete customer records', TRUE),
    (gen_random_uuid(), 'partners.view', 'partners', 'View Partners', 'View partner records and details', TRUE),
    (gen_random_uuid(), 'partners.create', 'partners', 'Create Partners', 'Create new partner records', TRUE),
    (gen_random_uuid(), 'partners.edit', 'partners', 'Edit existing partner records', 'Edit existing partner records', TRUE),
    (gen_random_uuid(), 'partners.delete', 'partners', 'Delete Partners', 'Delete partner records', TRUE),
    (gen_random_uuid(), 'leads.view', 'leads', 'View Leads', 'View lead records and details', TRUE),
    (gen_random_uuid(), 'leads.create', 'leads', 'Create Leads', 'Create new lead records', TRUE),
    (gen_random_uuid(), 'leads.edit', 'leads', 'Edit Leads', 'Edit existing lead records', TRUE),
    (gen_random_uuid(), 'leads.delete', 'leads', 'Delete Leads', 'Delete lead records', TRUE),
    (gen_random_uuid(), 'accounting.view', 'accounting', 'View Accounting', 'View accounting records and reports', TRUE),
    (gen_random_uuid(), 'accounting.create', 'accounting', 'Create Accounting', 'Create accounting entries', TRUE),
    (gen_random_uuid(), 'accounting.edit', 'accounting', 'Edit Accounting', 'Edit accounting entries', TRUE),
    (gen_random_uuid(), 'accounting.delete', 'accounting', 'Delete Accounting', 'Delete accounting entries', TRUE),
    (gen_random_uuid(), 'users.manage', 'users', 'Manage Users', 'Assign and revoke user roles', TRUE),
    (gen_random_uuid(), 'roles.manage', 'roles', 'Manage Roles', 'Create, edit, delete roles and assign rights', TRUE),
    (gen_random_uuid(), 'rights.manage', 'rights', 'Manage Rights', 'Manage the rights catalogue', TRUE)
ON CONFLICT DO NOTHING;
