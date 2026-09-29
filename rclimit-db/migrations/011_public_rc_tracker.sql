-- Migration 011: RC Pipeline Tracker and Verification Logs (public)

CREATE TABLE rc_pipeline_tracker (
    tracker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL UNIQUE REFERENCES loan_transactions(loan_id) ON DELETE CASCADE,
    current_stage VARCHAR(50) DEFAULT 'DISBURSED_PENDING_RTO',
    aging_status VARCHAR(20) DEFAULT 'ON_TIME',
    rto_ack_doc_url VARCHAR(255),
    final_rc_doc_url VARCHAR(255),
    ack_uploaded_at TIMESTAMPTZ,
    rc_cleared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_rc_tracker_loan ON rc_pipeline_tracker(loan_id);
CREATE INDEX idx_rc_tracker_stage ON rc_pipeline_tracker(current_stage);

CREATE TABLE verification_logs (
    verification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    vehicle_id UUID,
    customer_id UUID,
    verification_type VARCHAR(30) NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    result_status VARCHAR(20) DEFAULT 'PENDING',
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_tenant ON verification_logs(tenant_id);
CREATE INDEX idx_verification_vehicle ON verification_logs(vehicle_id);
CREATE INDEX idx_verification_customer ON verification_logs(customer_id);
