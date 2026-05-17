-- Enable RLS and allow any authenticated user to read cron run history
ALTER TABLE compliance_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON compliance_check_runs
  FOR SELECT TO authenticated USING (true);
