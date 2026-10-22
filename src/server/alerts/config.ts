// Operator alerts (index.ts). Change docs/runbook.md#alerts with these.

// Each kind of alert goes out at most once per hour.
export const ALERT_EVERY_MS = 60 * 60 * 1000;

// The sweep alerts when, of the videos that finished in the last hour, at least FAILURE_RATE_MIN_FINISHED did and at least
// FAILURE_RATE_THRESHOLD of them failed.
export const FAILURE_RATE_WINDOW_MS = 60 * 60 * 1000;
export const FAILURE_RATE_MIN_FINISHED = 5;
export const FAILURE_RATE_THRESHOLD = 0.3;

// Bailian (DashScope) error codes that mean the account can't pay for jobs:
// in arrears, or out of its free or paid quota. A DashScope key can't read
// the balance, so a job or submission failing with one of these is the
// signal. Check the list against Bailian's error-code page
// (https://help.aliyun.com/zh/model-studio/error-code) when it changes.
// Moderation codes such as DataInspectionFailed don't belong here.
export const PROVIDER_BALANCE_CODES: ReadonlySet<string> = new Set([
  "Arrearage",
  "AllocationQuota.FreeTierOnly",
  "Throttling.AllocationQuota",
]);
