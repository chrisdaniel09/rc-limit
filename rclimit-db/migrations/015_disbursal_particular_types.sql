CREATE TABLE disbursal_particular_types (
    particular_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_particular_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_particular_types_tenant ON disbursal_particular_types(tenant_id);
