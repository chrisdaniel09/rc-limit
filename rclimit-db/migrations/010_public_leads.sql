-- Migration 010: Leads / Conversational Intake (public)

CREATE TABLE leads (
    lead_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    lead_source VARCHAR(30) DEFAULT 'WHATSAPP_BOT',
    partner_id UUID REFERENCES partners(partner_id),
    whatsapp_phone_number VARCHAR(20) NOT NULL,
    applicant_name VARCHAR(150),
    requested_loan_amount DECIMAL(15,2),
    vehicle_registration_number VARCHAR(20),
    vahan_validation_status VARCHAR(30) DEFAULT 'PENDING',
    cibil_score_preview INT,
    lead_status VARCHAR(30) DEFAULT 'INBOUND_INCOMPLETE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(tenant_id, lead_status);
