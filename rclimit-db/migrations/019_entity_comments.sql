-- Date: 2026-10-05
-- Description: Add generic entity_comments table for call notes and comments on Leads, Customers, and Loans

IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entity_comments') THEN
  CREATE TABLE public.entity_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.tenants(tenant_id) ON DELETE CASCADE,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    comment_text TEXT NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT entity_type_check CHECK (entity_type IN ('LEAD', 'CUSTOMER', 'LOAN'))
  );

  CREATE INDEX idx_entity_comments_entity
    ON public.entity_comments(tenant_id, entity_type, entity_id, created_at DESC);

  GRANT SELECT, INSERT ON public.entity_comments TO app_user;
END IF;
