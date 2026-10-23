-- 024: Session families, rotation tracking and account lockout
-- Spec: docs/user_session_architecture_specification.md sections 6.3, 6.4, 8.1.
-- Idempotent: safe to run more than once.

-- 1. Refresh tokens: family, tenant, session start, revocation and rotation tracking
ALTER TABLE auth.refresh_tokens
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS family_id UUID,
    ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
    ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(30),
    ADD COLUMN IF NOT EXISTS replaced_by_token_id UUID,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- 2. Backfill legacy rows. Each legacy token becomes its own family, owned by its user's tenant.
UPDATE auth.refresh_tokens rt
SET tenant_id = u.tenant_id,
    family_id = COALESCE(rt.family_id, rt.token_id),
    session_started_at = COALESCE(rt.session_started_at, rt.created_at)
FROM auth.users u
WHERE u.user_id = rt.user_id
  AND (rt.tenant_id IS NULL OR rt.family_id IS NULL OR rt.session_started_at IS NULL);

-- Legacy revocations carry no reason; mark them so they are never mistaken for a rotation.
UPDATE auth.refresh_tokens
SET revoked_reason = 'LEGACY',
    revoked_at = COALESCE(revoked_at, created_at)
WHERE is_revoked = TRUE
  AND revoked_reason IS NULL;

ALTER TABLE auth.refresh_tokens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE auth.refresh_tokens ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE auth.refresh_tokens ALTER COLUMN session_started_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_family ON auth.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_tenant ON auth.refresh_tokens(tenant_id);

-- A token hash identifies exactly one row.
CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_tokens_hash ON auth.refresh_tokens(token_hash);

-- 3. Account lockout after repeated failed passwords (spec section 8.1)
ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
