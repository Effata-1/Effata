-- Migration 053: AI runs usage log
-- Written by Railway backend (service role). No user-facing select policy yet.

CREATE TABLE IF NOT EXISTS ai_runs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL,
  user_id       UUID,
  agent         TEXT        NOT NULL,
  run_type      TEXT        NOT NULL DEFAULT 'user',       -- 'user' | 'cron'
  status        TEXT        NOT NULL DEFAULT 'completed',  -- 'completed' | 'error' | 'timeout'
  model         TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  input_tokens  INT         NOT NULL DEFAULT 0,
  output_tokens INT         NOT NULL DEFAULT 0,
  latency_ms    INT         NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(10,6),                             -- USD, computed by Railway
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_runs_org_created_idx ON ai_runs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_agent_idx       ON ai_runs (agent, created_at DESC);

ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
-- No select policy yet — service role (Railway) bypasses RLS and can write freely.
-- Add an org-scoped select policy when a usage history UI is built.
