-- 003: Identity module. Users, external identities, sessions, roles and rights.
-- tenant_id is a plain column: tenants belong to the System module, so there is no cross-schema foreign key.

CREATE TABLE auth.users (
    user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID         NOT NULL,
    email              VARCHAR(255),
    phone_number       VARCHAR(20),
    password_hash      VARCHAR(255),
    password_salt      VARCHAR(255),
    full_name          VARCHAR(150),
    avatar_url         TEXT,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    two_factor_enabled BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_login_count INT          NOT NULL DEFAULT 0,
    locked_until       TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email),
    CONSTRAINT uq_users_tenant_phone UNIQUE (tenant_id, phone_number)
);

CREATE INDEX idx_auth_users_email ON auth.users(email);

CREATE TABLE auth.user_identities (
    identity_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    provider_type    VARCHAR(50)  NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    identity_data    JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT unique_provider_user UNIQUE (provider_type, provider_user_id)
);

-- Refresh tokens rotate within a session family. A reused token revokes its whole family.
CREATE TABLE auth.refresh_tokens (
    token_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID         NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    tenant_id            UUID         NOT NULL,
    token_hash           VARCHAR(255) NOT NULL,
    family_id            UUID         NOT NULL,
    session_started_at   TIMESTAMPTZ  NOT NULL,
    expires_at           TIMESTAMPTZ  NOT NULL,
    is_revoked           BOOLEAN      NOT NULL DEFAULT FALSE,
    revoked_at           TIMESTAMPTZ,
    revoked_reason       VARCHAR(30),
    replaced_by_token_id UUID,
    ip_address           VARCHAR(45),
    user_agent           VARCHAR(512),
    last_used_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_refresh_tokens_hash ON auth.refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user ON auth.refresh_tokens(user_id);
CREATE INDEX ix_refresh_tokens_family ON auth.refresh_tokens(family_id);
CREATE INDEX ix_refresh_tokens_tenant ON auth.refresh_tokens(tenant_id);

-- Rights are global. Roles belong to a tenant and group rights.
CREATE TABLE auth.rights (
    right_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50)  NOT NULL UNIQUE,
    module      VARCHAR(50)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE auth.roles (
    role_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID         NOT NULL,
    code        VARCHAR(50)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT roles_tenant_id_code_key UNIQUE (tenant_id, code)
);

CREATE TABLE auth.role_rights (
    role_id  UUID NOT NULL REFERENCES auth.roles(role_id) ON DELETE CASCADE,
    right_id UUID NOT NULL REFERENCES auth.rights(right_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, right_id)
);

CREATE TABLE auth.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES auth.roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
