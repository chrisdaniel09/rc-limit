-- 030: Product-neutral leads, step 2 (additive).
--   * Creates leads.action_executions: one row per run of an action defined on a product type.
--     Stores the request and response payloads as JSON. The table has no domain columns
--     (no score, no check type), so it does not depend on what an action does.
--   * Copies leads.lead_check_logs across as executions of the legacy actions CIBIL_CHECK and VAHAN_CHECK.
--     Each legacy row's score, status and remarks go into response_payload.
--   * Adds an execution for any lead whose current CIBIL or RC state has no matching record.
--   * leads.lead_check_logs and the per-check columns on leads.leads are kept until migration 031.
-- Runs as a single transaction. Safe to re-run.

BEGIN;

-- 1. Generic execution record. status is the run lifecycle only. Domain outcomes (PASSED, FAILED, a score)
--    belong to the action and are stored in response_payload.
CREATE TABLE IF NOT EXISTS leads.action_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads.leads(lead_id) ON DELETE CASCADE,
    product_type_code VARCHAR(30) NOT NULL,
    action_code VARCHAR(50) NOT NULL,
    action_order INT,
    status VARCHAR(20) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    performed_by_user_id UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_action_executions_lead_action
    ON leads.action_executions(tenant_id, lead_id, action_code, started_at DESC);

-- 2. Copy the legacy check log. CIBIL becomes CIBIL_CHECK and RC becomes VAHAN_CHECK.
--    action_order stays NULL because the legacy rows had no product-defined order.
INSERT INTO leads.action_executions
    (execution_id, tenant_id, lead_id, product_type_code, action_code, status, source,
     response_payload, performed_by_user_id, started_at, completed_at)
SELECT
    cl.log_id,
    cl.tenant_id,
    cl.lead_id,
    l.product_type_code,
    CASE WHEN cl.check_type = 'RC' THEN 'VAHAN_CHECK' ELSE 'CIBIL_CHECK' END,
    'SUCCEEDED',
    cl.source,
    jsonb_strip_nulls(jsonb_build_object('outcome', cl.status, 'score', cl.score, 'remarks', cl.remarks)),
    cl.performed_by_user_id,
    cl.created_at,
    cl.created_at
FROM leads.lead_check_logs cl
JOIN leads.leads l ON l.lead_id = cl.lead_id
ON CONFLICT (execution_id) DO NOTHING;

-- 3. A lead whose current CIBIL state has no matching execution gets one.
INSERT INTO leads.action_executions
    (tenant_id, lead_id, product_type_code, action_code, status, source, response_payload, started_at, completed_at)
SELECT l.tenant_id, l.lead_id, l.product_type_code, 'CIBIL_CHECK', 'SUCCEEDED', 'MANUAL',
       jsonb_strip_nulls(jsonb_build_object('outcome', l.cibil_check_status, 'score', l.cibil_score_preview)),
       COALESCE(l.cibil_checked_at, l.updated_at, l.created_at),
       COALESCE(l.cibil_checked_at, l.updated_at, l.created_at)
FROM leads.leads l
WHERE l.cibil_check_status <> 'NOT_STARTED'
  AND NOT EXISTS (
        SELECT 1 FROM leads.action_executions ae
        WHERE ae.lead_id = l.lead_id
          AND ae.action_code = 'CIBIL_CHECK'
          AND ae.response_payload->>'outcome' = l.cibil_check_status
          AND ae.response_payload->>'score' IS NOT DISTINCT FROM l.cibil_score_preview::text
  );

-- 4. The same for the RC state, which becomes VAHAN_CHECK. The legacy RC state has no score.
INSERT INTO leads.action_executions
    (tenant_id, lead_id, product_type_code, action_code, status, source, response_payload, started_at, completed_at)
SELECT l.tenant_id, l.lead_id, l.product_type_code, 'VAHAN_CHECK', 'SUCCEEDED', 'MANUAL',
       jsonb_build_object('outcome', l.rc_check_status),
       COALESCE(l.rc_checked_at, l.updated_at, l.created_at),
       COALESCE(l.rc_checked_at, l.updated_at, l.created_at)
FROM leads.leads l
WHERE l.rc_check_status <> 'NOT_STARTED'
  AND NOT EXISTS (
        SELECT 1 FROM leads.action_executions ae
        WHERE ae.lead_id = l.lead_id
          AND ae.action_code = 'VAHAN_CHECK'
          AND ae.response_payload->>'outcome' = l.rc_check_status
  );

COMMIT;
