-- 032: Removes the requested_amount column from leads.leads.
--   * The Requested Amount field is no longer captured on leads or shown in the UI.
--   * The legacy requested_loan_amount column is left in place.
-- Runs as a single transaction. Safe to re-run.

BEGIN;

ALTER TABLE leads.leads DROP COLUMN IF EXISTS requested_amount;

COMMIT;
