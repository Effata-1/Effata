-- P1-3: GenAI Policy Library
-- Stores named governance policy documents per org (not technical DLP rules — those live in the control matrix)

CREATE TABLE org_genai_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  policy_type       TEXT NOT NULL DEFAULT 'usage',   -- 'usage' | 'data-handling' | 'approved-use' | 'prohibited'
  category_id       UUID REFERENCES org_genai_governance_categories(id) ON DELETE SET NULL,
  approval_status   TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'under-review' | 'approved' | 'rejected' | 'expired'
  policy_owner      TEXT,
  technical_owner   TEXT,
  effective_date    DATE,
  review_date       DATE,
  next_review_date  DATE,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  priority          INTEGER NOT NULL DEFAULT 99,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE org_genai_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_genai_policies
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_insert" ON org_genai_policies
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_update" ON org_genai_policies
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_delete" ON org_genai_policies
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
