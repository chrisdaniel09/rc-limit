-- Migration 007: Vehicles (public)

CREATE TABLE vehicles (
    vehicle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    registration_number VARCHAR(20) NOT NULL,
    chassis_number VARCHAR(50),
    engine_number VARCHAR(50),
    make VARCHAR(50),
    model VARCHAR(50),
    variant VARCHAR(50),
    year_of_mfg INT,
    ownership_count INT DEFAULT 1,
    current_rto_status VARCHAR(30) DEFAULT 'CLEAN',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX idx_vehicles_reg ON vehicles(registration_number);
