CREATE TABLE ai_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  user_id          UUID,
  job_type         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  payload          JSONB NOT NULL DEFAULT '{}',
  result           JSONB,
  error            TEXT,
  attempts         INT NOT NULL DEFAULT 0,
  max_attempts     INT NOT NULL DEFAULT 3,
  total_items      INT,
  processed_items  INT NOT NULL DEFAULT 0,
  locked_at        TIMESTAMPTZ,
  locked_by        TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_jobs_pending_idx ON ai_jobs (created_at)
  WHERE status = 'pending';
CREATE INDEX ai_jobs_org_idx ON ai_jobs (org_id, created_at DESC);
CREATE INDEX ai_jobs_type_active_idx ON ai_jobs (job_type, status)
  WHERE status IN ('pending', 'running');

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON ai_jobs
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Atomic claim: selects the oldest pending job, locks it, and returns it.
-- Called by the Railway worker via serviceClient.rpc('claim_next_job', { worker_id }).
-- SECURITY DEFINER so the worker's service-role call always bypasses RLS on this fn.
CREATE OR REPLACE FUNCTION claim_next_job(worker_id TEXT)
RETURNS SETOF ai_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_jobs
  SET
    status     = 'running',
    locked_at  = now(),
    locked_by  = worker_id,
    attempts   = attempts + 1,
    started_at = now()
  WHERE id = (
    SELECT id FROM ai_jobs
    WHERE status = 'pending' AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
