ALTER TABLE compliance_check_runs
  ADD COLUMN IF NOT EXISTS regs_added integer DEFAULT 0;
