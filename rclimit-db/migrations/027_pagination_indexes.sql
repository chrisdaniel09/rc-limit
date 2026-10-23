-- 027: Indexes for server-side paging, default ordering and name sorting on list screens.
-- Each index starts with tenant_id because every list query filters by tenant first.
-- The primary key is appended as the final sort key so pages are stable when created_at or names collide.
-- Idempotent: safe to run more than once.

-- Leads and loans default to newest first (ORDER BY created_at DESC, <pk> DESC).
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at DESC, lead_id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant_created ON loan_transactions(tenant_id, created_at DESC, loan_id);

-- Customers and partners sort by legal name by default.
CREATE INDEX IF NOT EXISTS idx_customers_tenant_legal_name ON customers(tenant_id, legal_name, customer_id);
CREATE INDEX IF NOT EXISTS idx_partners_tenant_legal_name ON partners(tenant_id, legal_name, partner_id);
