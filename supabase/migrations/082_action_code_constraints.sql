-- Migration 082: Add CHECK constraints on action_code in coaching + matrix tables.
-- Normalizes legacy data before constraining.

-- 1. Inspect non-standard values (informational — does not block migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM org_coaching_notifications
    WHERE action_code NOT IN ('coach', 'coach-ack', 'coach-just')
  ) THEN
    RAISE NOTICE 'Found non-standard action_code values in org_coaching_notifications';
  END IF;
  IF EXISTS (
    SELECT 1 FROM org_control_matrix_overrides
    WHERE action_code NOT IN ('allow', 'monitor', 'alert', 'coach', 'coach-ack', 'coach-just', 'block', 'not-set')
  ) THEN
    RAISE NOTICE 'Found non-standard action_code values in org_control_matrix_overrides';
  END IF;
END $$;

-- 2. Backfill: normalize bare 'coach' in org_control_matrix_overrides where the linked
--    coaching template has control_type = 'block' — these should be stored as 'block'.
UPDATE org_control_matrix_overrides m
SET action_code = 'block'
FROM org_coaching_notifications n
WHERE m.coaching_notification_id = n.id
  AND m.action_code = 'coach'
  AND n.control_type = 'block';

-- 3. Drop constraints if they already exist (idempotent re-run safety)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_coaching_notifications_action_code_check'
      AND conrelid = 'org_coaching_notifications'::regclass
  ) THEN
    ALTER TABLE org_coaching_notifications DROP CONSTRAINT org_coaching_notifications_action_code_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_control_matrix_overrides_action_code_check'
      AND conrelid = 'org_control_matrix_overrides'::regclass
  ) THEN
    ALTER TABLE org_control_matrix_overrides DROP CONSTRAINT org_control_matrix_overrides_action_code_check;
  END IF;
END $$;

-- 4. Add constraints as NOT VALID (skips full table scan — applied only to new rows immediately)
--    'coach' is kept for org_coaching_notifications because controlTypeToActionCode maps block → 'coach'.
ALTER TABLE org_coaching_notifications
  ADD CONSTRAINT org_coaching_notifications_action_code_check
  CHECK (action_code IN ('coach', 'coach-ack', 'coach-just')) NOT VALID;

ALTER TABLE org_control_matrix_overrides
  ADD CONSTRAINT org_control_matrix_overrides_action_code_check
  CHECK (action_code IN ('allow', 'monitor', 'alert', 'coach', 'coach-ack', 'coach-just', 'block', 'not-set')) NOT VALID;

-- 5. Validate constraints against all existing rows
--    This will fail if the backfill in step 2 missed any dirty data.
ALTER TABLE org_coaching_notifications
  VALIDATE CONSTRAINT org_coaching_notifications_action_code_check;

ALTER TABLE org_control_matrix_overrides
  VALIDATE CONSTRAINT org_control_matrix_overrides_action_code_check;
