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
    CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES system.tenants(tenant_id)
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

