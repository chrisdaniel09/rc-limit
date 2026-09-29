-- Migration 012: Add owner_customer_id FK to vehicles

ALTER TABLE vehicles ADD COLUMN owner_customer_id UUID REFERENCES customers(customer_id);

CREATE INDEX idx_vehicles_owner ON vehicles(owner_customer_id);
