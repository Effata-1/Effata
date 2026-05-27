-- Allow null user_id in audit_logs for system/worker-triggered events
-- (cron jobs, background workers) that have no associated user.
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;
