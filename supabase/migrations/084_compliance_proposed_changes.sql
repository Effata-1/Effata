-- AI Staging for Compliance Changes
-- AI proposes changes; admin approves before they reach the live compliance tables.
-- Live compliance_regulations and compliance_requirements are never mutated by AI directly.

CREATE TABLE IF NOT EXISTS compliance_proposed_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid REFERENCES compliance_check_runs(id) ON DELETE SET NULL,
  regulation_id   uuid REFERENCES compliance_regulations(id) ON DELETE CASCADE,
  -- null for new_regulation proposals (regulation doesn't exist yet)
  -- set  for update_regulation proposals
  change_type     text NOT NULL CHECK (change_type IN ('update_regulation', 'new_regulation')),
  proposed_data   jsonb NOT NULL,
  -- update_regulation: { summary?, max_fine?, requirements: [{article, field, new_value}] }
  -- new_regulation:    full NewRegulation object with requirements[]
  current_data    jsonb,
  -- update_regulation: { summary, max_fine, requirements: [{id, article, description, ...}] }
  -- new_regulation:    null
  ai_reason       text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  reviewed_by     uuid,
  review_notes    text,
  created_at      timestamptz DEFAULT now(),
  reviewed_at     timestamptz,
  applied_at      timestamptz
);

ALTER TABLE compliance_proposed_changes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read proposals (global reference data, no org filter)
CREATE POLICY "authenticated_read" ON compliance_proposed_changes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can approve/reject proposals
-- Defence-in-depth: RLS enforces role AND server action calls requireRole('admin')
CREATE POLICY "admin_update" ON compliance_proposed_changes
  FOR UPDATE USING  ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- Track proposal count on the run record (regs_updated stays for backward compat but is always 0)
ALTER TABLE compliance_check_runs
  ADD COLUMN IF NOT EXISTS regs_proposed integer DEFAULT 0;

-- Admin write policies for the live compliance tables.
-- Railway backend uses serviceClient (service-role) which already bypasses RLS.
-- These policies are for the Next.js approveProposal server action which uses the
-- authenticated supabase client.
CREATE POLICY "admin_update_regulations" ON compliance_regulations
  FOR UPDATE USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "admin_insert_regulations" ON compliance_regulations
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "admin_update_requirements" ON compliance_requirements
  FOR UPDATE USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "admin_insert_requirements" ON compliance_requirements
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- compliance_verification_log currently has only org-scoped RLS.
-- approveProposal() writes a global audit row (org_id = nil UUID) from the admin user,
-- so we need an explicit admin insert policy or the insert will be blocked.
CREATE POLICY "admin_insert_verification_log" ON compliance_verification_log
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');
