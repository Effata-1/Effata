-- Migration 004: GenAI auto-research infrastructure

CREATE TABLE IF NOT EXISTS genai_research_runs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at   TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  apps_updated INT         NOT NULL    DEFAULT 0,
  apps_added   INT         NOT NULL    DEFAULT 0,
  errors       JSONB       NOT NULL    DEFAULT '[]',
  status       TEXT        NOT NULL    DEFAULT 'running'
                           CHECK (status IN ('running', 'completed', 'failed'))
);

ALTER TABLE genai_apps
  ADD COLUMN IF NOT EXISTS auto_researched BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS research_notes  TEXT;

CREATE INDEX IF NOT EXISTS idx_genai_apps_last_updated
  ON genai_apps (last_updated ASC NULLS FIRST);
