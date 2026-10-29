-- 002: System module. Tenants and their settings.

CREATE TABLE system.tenants (
    tenant_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name          VARCHAR(150) NOT NULL,
    slug                       VARCHAR(50)  NOT NULL UNIQUE,
    custom_domain              VARCHAR(150) UNIQUE,
    subscription_plan          VARCHAR(30)  NOT NULL DEFAULT 'ENTERPRISE',
    is_active                  BOOLEAN      NOT NULL DEFAULT TRUE,
    database_connection_string TEXT,
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_tenant_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);

-- One row per tenant. A NULL session setting means "use the application default".
CREATE TABLE system.tenant_settings (
    setting_id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                        UUID        NOT NULL UNIQUE REFERENCES system.tenants(tenant_id) ON DELETE CASCADE,
    max_active_dealers               INT         NOT NULL DEFAULT 50,
    allow_whatsapp_intake            BOOLEAN     NOT NULL DEFAULT TRUE,
    custom_vahan_api_key             VARCHAR(255),
    custom_cibil_gateway_credentials JSONB,
    access_token_minutes             INT,
    idle_timeout_days                INT,
    absolute_timeout_days            INT,
    max_sessions_per_user            INT,
    created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_tenant_settings_access_minutes  CHECK (access_token_minutes IS NULL OR access_token_minutes BETWEEN 5 AND 60),
    CONSTRAINT ck_tenant_settings_idle_days       CHECK (idle_timeout_days IS NULL OR idle_timeout_days BETWEEN 1 AND 30),
    CONSTRAINT ck_tenant_settings_absolute_days   CHECK (absolute_timeout_days IS NULL OR absolute_timeout_days BETWEEN 1 AND 90),
    CONSTRAINT ck_tenant_settings_absolute_ge_idle CHECK (absolute_timeout_days IS NULL OR idle_timeout_days IS NULL OR absolute_timeout_days >= idle_timeout_days),
    CONSTRAINT ck_tenant_settings_max_sessions    CHECK (max_sessions_per_user IS NULL OR max_sessions_per_user BETWEEN 1 AND 50)
);
