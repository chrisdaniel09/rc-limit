-- 025: Tenant-specific session policy (spec section 5)
-- Null means "use the platform default". Ranges are enforced in the database as well as in code.
-- Idempotent: safe to run more than once.

ALTER TABLE system.tenant_settings
    ADD COLUMN IF NOT EXISTS access_token_minutes INT,
    ADD COLUMN IF NOT EXISTS idle_timeout_days INT,
    ADD COLUMN IF NOT EXISTS absolute_timeout_days INT,
    ADD COLUMN IF NOT EXISTS max_sessions_per_user INT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_settings_access_minutes') THEN
        ALTER TABLE system.tenant_settings ADD CONSTRAINT ck_tenant_settings_access_minutes
            CHECK (access_token_minutes IS NULL OR access_token_minutes BETWEEN 5 AND 60);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_settings_idle_days') THEN
        ALTER TABLE system.tenant_settings ADD CONSTRAINT ck_tenant_settings_idle_days
            CHECK (idle_timeout_days IS NULL OR idle_timeout_days BETWEEN 1 AND 30);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_settings_absolute_days') THEN
        ALTER TABLE system.tenant_settings ADD CONSTRAINT ck_tenant_settings_absolute_days
            CHECK (absolute_timeout_days IS NULL OR absolute_timeout_days BETWEEN 1 AND 90);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_settings_absolute_ge_idle') THEN
        ALTER TABLE system.tenant_settings ADD CONSTRAINT ck_tenant_settings_absolute_ge_idle
            CHECK (absolute_timeout_days IS NULL OR idle_timeout_days IS NULL
                   OR absolute_timeout_days >= idle_timeout_days);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_settings_max_sessions') THEN
        ALTER TABLE system.tenant_settings ADD CONSTRAINT ck_tenant_settings_max_sessions
            CHECK (max_sessions_per_user IS NULL OR max_sessions_per_user BETWEEN 1 AND 50);
    END IF;
END $$;

-- One settings row per tenant, so the policy lookup is unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_settings_tenant ON system.tenant_settings(tenant_id);
