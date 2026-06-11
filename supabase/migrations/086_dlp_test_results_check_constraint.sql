-- Migration 086: expand dlp_test_results result CHECK constraint
--
-- Migration 008 only allowed 'blocked','not_blocked','error' but the app already
-- writes 'user_alert_proceed', 'user_alert_stop', 'blocked_coached' via
-- updateTestResultUserAlert — a live constraint violation. Also adds 'inconclusive'
-- for network failures that are ambiguous (DLP may or may not have been involved).

ALTER TABLE dlp_test_results DROP CONSTRAINT IF EXISTS dlp_test_results_result_check;

ALTER TABLE dlp_test_results ADD CONSTRAINT dlp_test_results_result_check
  CHECK (result IN (
    'blocked',
    'not_blocked',
    'error',
    'user_alert_proceed',
    'user_alert_stop',
    'blocked_coached',
    'inconclusive'
  ));
