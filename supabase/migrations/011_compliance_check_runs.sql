-- Tracks every weekly compliance cron run — system table, no org_id needed
CREATE TABLE IF NOT EXISTS compliance_check_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz,
  status        text DEFAULT 'running',  -- running | completed | failed
  regs_checked  integer DEFAULT 0,
  regs_updated  integer DEFAULT 0,
  changes       jsonb DEFAULT '[]',
  errors        jsonb DEFAULT '[]'
);
