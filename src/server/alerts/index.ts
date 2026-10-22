import { and, count, gte, inArray, lt, lte, or, gt, sql } from "drizzle-orm";
import { projectConfig } from "project.config";
import { adminEmails } from "@/server/admin/access";
import { getDb } from "@/server/db";
import { sendEmail } from "@/server/email/client";
import { escapeHtml } from "@/server/email/templates/escape";
import { log } from "@/server/log";
import { video } from "@/server/videos/schema";
import {
  ALERT_EVERY_MS,
  FAILURE_RATE_MIN_FINISHED,
  FAILURE_RATE_THRESHOLD,
  FAILURE_RATE_WINDOW_MS,
  PROVIDER_BALANCE_CODES,
} from "./config";
import { alert } from "./schema";

export type AlertKind = "failure_rate" | "provider_balance";

const WEBHOOK_TIMEOUT_MS = 5000;

// Claims this hour's alert of the kind: true for the one caller that may
// send it. The row stays claimed if delivery then fails, so a broken
// webhook can't make every sweep resend. A sent time in the future (a
// skewed clock) counts as stale.
async function claim(kind: AlertKind, now: Date): Promise<boolean> {
  const before = new Date(now.getTime() - ALERT_EVERY_MS);
  const claimed = await getDb()
    .insert(alert)
    .values({ kind, sentAt: now })
    .onConflictDoUpdate({
      target: alert.kind,
      set: { sentAt: now },
      setWhere: or(lte(alert.sentAt, before), gt(alert.sentAt, now)),
    })
    .returning({ kind: alert.kind });
  return claimed.length > 0;
}

// Feishu and Lark custom bots take their own shape; Slack and most others
// take { text }.
function webhookBody(url: string, text: string) {
  const host = URL.parse(url)?.hostname ?? "";
  return /(^|\.)(feishu\.cn|larksuite\.com)$/.test(host) ? { msg_type: "text", content: { text } } : { text };
}

// Emails every ADMIN_EMAILS address and posts to ALERT_WEBHOOK_URL, each
// if set; with neither, the log line is the alert. Never throws.
async function deliver(kind: AlertKind, subject: string, text: string) {
  log.warn("alert.sent", { kind, text });
  const admins = adminEmails();
  const webhook = process.env.ALERT_WEBHOOK_URL;
  const message = `[${projectConfig.name}] ${text}`;
  await Promise.all([
    ...admins.map((to) =>
      sendEmail({ to, subject: `[${projectConfig.name}] ${subject}`, text, html: `<p>${escapeHtml(text)}</p>` }).catch(
        (error) => log.error("alert.email_failed", { kind, error }),
      ),
    ),
    webhook &&
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookBody(webhook, message)),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      }).then(
        (response) => {
          if (!response.ok) log.error("alert.webhook_failed", { kind, status: response.status });
        },
        (error) => log.error("alert.webhook_failed", { kind, error }),
      ),
  ]);
}

// Sends an alert unless one of its kind went out within the last hour.
// True if this call sent it. Never throws: alerting must not fail the job
// that noticed the problem.
export async function sendAlert(kind: AlertKind, subject: string, text: string, now = new Date()): Promise<boolean> {
  try {
    if (!(await claim(kind, now))) return false;
    await deliver(kind, subject, text);
    return true;
  } catch (error) {
    log.error("alert.failed", { kind, error });
    return false;
  }
}

function metricsUrl() {
  const base = URL.parse(process.env.BETTER_AUTH_URL ?? "");
  return base ? new URL("/en/admin/metrics?days=1", base).href : "/en/admin/metrics?days=1";
}

// How the videos that finished in the hour before `now` went, and an alert
// if too many failed. For the sweep. Never throws.
export async function checkFailureRate(now = new Date()): Promise<{ finished: number; failed: number; alerted: boolean }> {
  try {
    const since = new Date(now.getTime() - FAILURE_RATE_WINDOW_MS);
    const [{ finished, failed }] = await getDb()
      .select({
        finished: count(),
        failed: sql`count(*) filter (where ${video.status} = 'failed')`.mapWith(Number),
      })
      .from(video)
      .where(and(inArray(video.status, ["succeeded", "failed"]), gte(video.completedAt, since), lt(video.completedAt, now)));
    if (finished < FAILURE_RATE_MIN_FINISHED || failed / finished < FAILURE_RATE_THRESHOLD) {
      return { finished, failed, alerted: false };
    }
    const percent = Math.round((failed / finished) * 100);
    const alerted = await sendAlert(
      "failure_rate",
      `Generation failure rate ${percent}%`,
      `${failed} of ${finished} videos (${percent}%) that finished in the last hour failed. Failed jobs are refunded. See the top failures at ${metricsUrl()}`,
      now,
    );
    return { finished, failed, alerted };
  } catch (error) {
    log.error("alert.check_failed", { kind: "failure_rate", error });
    return { finished: 0, failed: 0, alerted: false };
  }
}

// Alerts at once when a provider refuses a job for the account's balance or
// quota (PROVIDER_BALANCE_CODES). `kind` is the generation kind, such as
// "video". Never throws.
export async function checkProviderError(kind: string, code: string | undefined, now = new Date()): Promise<boolean> {
  if (!code || !PROVIDER_BALANCE_CODES.has(code)) return false;
  return sendAlert(
    "provider_balance",
    `Bailian balance or quota: ${code}`,
    `Bailian refused a ${kind} job with ${code}: the account may be in arrears or out of quota. Top up or raise the quota in the Bailian console. Until then new jobs fail and are refunded.`,
    now,
  );
}
