-- 2026-10-16 Lead-Customer and Customer-Vehicle relationship tables
-- Creates lead_customers (lead -> customer mapping) and customer_vehicles (customer -> vehicle ownership history)

-- lead_customers: records each lead conversion (lead -> customer relation, with match basis and metadata)
CREATE TABLE lead_customers (
    lead_customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    lead_id UUID NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    link_type VARCHAR(50) NOT NULL DEFAULT 'CREATED', -- CREATED | LINKED_EXISTING
    match_basis VARCHAR(50), -- PHONE | NAME | MANUAL (populated only when LINKED_EXISTING)
    linked_by_user_id UUID,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lead_customers_tenant FOREIGN KEY (tenant_id) REFERENCES system.tenants(tenant_id),
    CONSTRAINT fk_lead_customers_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id),
    CONSTRAINT fk_lead_customers_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT fk_lead_customers_user FOREIGN KEY (linked_by_user_id) REFERENCES auth.users(user_id)
);

CREATE INDEX idx_lead_customers_tenant ON lead_customers(tenant_id);
CREATE INDEX idx_lead_customers_customer ON lead_customers(customer_id);
CREATE INDEX idx_lead_customers_linked_at ON lead_customers(tenant_id, linked_at DESC);

-- customer_vehicles: ownership history of vehicles (customer -> vehicle mapping with dates and transfer tracking)
CREATE TABLE customer_vehicles (
    customer_vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    source_lead_id UUID, -- the lead that brought this vehicle in (can be null if manual add)
    owned_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owned_to TIMESTAMPTZ,
    end_reason VARCHAR(50), -- TRANSFERRED | SOLD (null means currently owned)
    CONSTRAINT fk_customer_vehicles_tenant FOREIGN KEY (tenant_id) REFERENCES system.tenants(tenant_id),
    CONSTRAINT fk_customer_vehicles_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT fk_customer_vehicles_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    CONSTRAINT fk_customer_vehicles_source_lead FOREIGN KEY (source_lead_id) REFERENCES leads(lead_id)
);

CREATE INDEX idx_customer_vehicles_tenant ON customer_vehicles(tenant_id);
CREATE INDEX idx_customer_vehicles_customer ON customer_vehicles(customer_id);
CREATE INDEX idx_customer_vehicles_vehicle ON customer_vehicles(vehicle_id);
-- Partial unique index: only one open (owned_to IS NULL) ownership per vehicle
CREATE UNIQUE INDEX uk_customer_vehicles_open ON customer_vehicles(vehicle_id) WHERE owned_to IS NULL;

