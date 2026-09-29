-- Migration 002: System Control Schema (system)

CREATE TABLE system.tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_name VARCHAR(150) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    custom_domain VARCHAR(150) UNIQUE,
    subscription_plan VARCHAR(30) DEFAULT 'ENTERPRISE',
    is_active BOOLEAN DEFAULT TRUE,
    database_connection_string TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system.tenant_settings (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system.tenants(tenant_id) ON DELETE CASCADE,
    max_active_dealers INT DEFAULT 50,
    allow_whatsapp_intake BOOLEAN DEFAULT TRUE,
    custom_vahan_api_key VARCHAR(255),
    custom_cibil_gateway_credentials JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_settings_tenant ON system.tenant_settings(tenant_id);
