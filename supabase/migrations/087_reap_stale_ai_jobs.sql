-- Migration 087: reap_stale_ai_jobs Postgres function
--
-- PostgREST query builder cannot express column-to-column comparisons
-- (attempts < max_attempts), so the stale-lock logic lives in a Postgres
-- function called from the backend worker via serviceClient.rpc().
--
-- Behaviour:
--   • running jobs locked_at < p_stale_before AND attempts < max_attempts
--     → reset to pending, clear lock  (attempts NOT incremented — claim_next_job does that)
--   • running jobs locked_at < p_stale_before AND attempts >= max_attempts
--     → permanently failed (job exhausted its retry budget while orphaned)

CREATE OR REPLACE FUNCTION reap_stale_ai_jobs(p_stale_before timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Jobs with retries remaining → back to pending
  UPDATE ai_jobs
  SET    status    = 'pending',
         locked_at = NULL,
         locked_by = NULL
  WHERE  status    = 'running'
    AND  locked_at < p_stale_before
    AND  attempts  < max_attempts;

  -- Jobs that exhausted their retry budget → permanently failed
  UPDATE ai_jobs
  SET    status       = 'failed',
         error        = 'Job timed out and exhausted retry budget',
         completed_at = now(),
         locked_at    = NULL,
         locked_by    = NULL
  WHERE  status    = 'running'
    AND  locked_at < p_stale_before
    AND  attempts  >= max_attempts;
END;
$$;
