-- Extend dlp_test_results result enum to include user alert outcomes.
-- user_alert_proceed: DLP showed coaching popup, analyst clicked Proceed (data left)
-- user_alert_stop:    DLP showed coaching popup, analyst clicked Stop (data stayed)
-- blocked_coached:    DLP blocked the transfer and showed a block-notification popup (OK only)

ALTER TABLE dlp_test_results
  DROP CONSTRAINT IF EXISTS dlp_test_results_result_check;

ALTER TABLE dlp_test_results
  ADD CONSTRAINT dlp_test_results_result_check
  CHECK (result IN ('blocked', 'not_blocked', 'error', 'user_alert_proceed', 'user_alert_stop', 'blocked_coached'));
