-- Migration 013: Add lead origin metadata

ALTER TABLE leads ADD COLUMN referred_by_user_id UUID REFERENCES auth.users(user_id);
ALTER TABLE leads ADD COLUMN contact_phone VARCHAR(20);
ALTER TABLE leads ADD COLUMN notes TEXT;

CREATE INDEX idx_leads_referred_by ON leads(referred_by_user_id);
