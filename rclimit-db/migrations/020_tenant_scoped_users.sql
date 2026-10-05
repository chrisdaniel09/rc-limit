-- Migration 020: Tenant-scoped users with domain-based resolution
-- Date: 2026-10-05
-- Description: Support multi-tenancy by domain/custom domain, fix zero-tenant users, add constraints

-- 1. Register the current Azure deployment as tenant 1's domain
UPDATE system.tenants
SET custom_domain = 'ashy-hill-006ad3900.4.azurestaticapps.net'
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 2. Repair any existing users with the zero tenant (default Guid.Empty)
-- This reassigns them to the seeded Anna Finance tenant
UPDATE auth.users
SET tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE tenant_id = '00000000-0000-0000-0000-000000000000';

-- 3. Add slug validation check: must be a valid DNS label
ALTER TABLE system.tenants
ADD CONSTRAINT ck_tenant_slug_format
CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

-- 4. Add Foreign Key constraint on auth.users.tenant_id
ALTER TABLE auth.users
ADD CONSTRAINT fk_users_tenant
FOREIGN KEY (tenant_id) REFERENCES system.tenants(tenant_id) ON DELETE CASCADE;

-- 5. Replace global UNIQUE email constraint with per-tenant uniqueness
-- Get the name of the current global email unique constraint and drop it
ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_email_key;
-- Add per-tenant unique constraint on email
ALTER TABLE auth.users
ADD CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email);

-- 6. Replace global UNIQUE phone_number constraint with per-tenant uniqueness
ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_phone_number_key;
-- Add per-tenant unique constraint on phone_number
ALTER TABLE auth.users
ADD CONSTRAINT uq_users_tenant_phone UNIQUE (tenant_id, phone_number);

-- 7. Recreate indexes to support the new per-tenant lookups
DROP INDEX IF EXISTS idx_auth_users_email;
CREATE INDEX idx_auth_users_tenant_email ON auth.users(tenant_id, email);
CREATE INDEX idx_auth_users_tenant_phone ON auth.users(tenant_id, phone_number);
