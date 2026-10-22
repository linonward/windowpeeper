import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import type { Email } from "@/server/email/client";
import { video } from "@/server/videos/schema";
import { alert } from "./schema";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<(email: Email) => Promise<void>>(async () => {}) }));
vi.mock("@/server/email/client", () => ({ sendEmail }));
const { checkFailureRate, checkProviderError, sendAlert } = await import("./index");

const cleanup: string[] = [];
let fetcher: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  // Only this file writes alerts, one test at a time.
  await getDb().delete(alert);
  vi.stubEnv("ADMIN_EMAILS", "ops@example.com, owner@example.com");
  vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.slack.test/services/T0/B0/x");
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
  fetcher = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetcher);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  const ctx = await auth.$context;
  // Deleting a user deletes their videos.
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

// Each test checks an hour of its own in the past, so jobs other tests
// finish now never fall in it.
function hour() {
  const now = new Date(Date.UTC(2002, 0, 1) + Math.floor(Math.random() * 1e6) * 60_000);
  return { now, ago: (minutes: number) => new Date(now.getTime() - minutes * 60_000) };
}

async function finished(outcomes: { status: "succeeded" | "failed"; at: Date }[]) {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `alerts-${randomUUID()}@example.com`, name: "Alerts" },
    { method: "admin" },
  );
  cleanup.push(user.id);
  for (const { status, at } of outcomes) {
    await getDb().insert(video).values({
      userId: user.id,
      status,
      prompt: "p",
      createdAt: at,
      completedAt: at,
      duration: 5,
      provider: "dashscope",
      resolution: "720p",
      credits: 10,
    });
  }
}

const many = (count: number, status: "succeeded" | "failed", at: Date) =>
  Array.from({ length: count }, () => ({ status, at }));

test("alerts when at least 30% of at least 5 jobs that finished in the last hour failed", async () => {
  const { now, ago } = hour();
  await finished([...many(5, "succeeded", ago(10)), ...many(2, "failed", ago(59)), ...many(1, "failed", ago(5))]);
  // Outside the hour.
  await finished(many(5, "succeeded", ago(61)));

  await expect(checkFailureRate(now)).resolves.toEqual({ finished: 8, failed: 3, alerted: true });

  expect(sendEmail.mock.calls.map(([email]) => email.to)).toEqual(["ops@example.com", "owner@example.com"]);
  expect(sendEmail.mock.calls[0][0]).toMatchObject({
    subject: "[AIRumpelstiltskinVideo] Generation failure rate 38%",
    text: expect.stringContaining("3 of 8 videos (38%)"),
  });
  expect(sendEmail.mock.calls[0][0].text).toContain("https://app.example.com/en/admin/metrics?days=1");
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("https://hooks.slack.test/services/T0/B0/x", expect.objectContaining({ method: "POST" }));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ text: expect.stringMatching(/^\[AIRumpelstiltskinVideo\] 3 of 8/) });
});

test("stays quiet below the threshold or with too few jobs", async () => {
  const quiet = hour();
  await finished([...many(8, "succeeded", quiet.ago(5)), ...many(2, "failed", quiet.ago(5))]);
  await expect(checkFailureRate(quiet.now)).resolves.toEqual({ finished: 10, failed: 2, alerted: false });

  const few = hour();
  await finished(many(4, "failed", few.ago(5)));
  await expect(checkFailureRate(few.now)).resolves.toEqual({ finished: 4, failed: 4, alerted: false });

  expect(sendEmail).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

test("sends each kind at most once an hour", async () => {
  const { now } = hour();
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  expect(await sendAlert("failure_rate", "S", "T", now)).toBe(true);
  expect(await sendAlert("failure_rate", "S", "T", at(59))).toBe(false);
  // Another kind has its own hour.
  expect(await sendAlert("provider_balance", "S", "T", at(1))).toBe(true);
  expect(await sendAlert("failure_rate", "S", "T", at(60))).toBe(true);

  expect(fetcher).toHaveBeenCalledTimes(3);
});

test("two sweeps noticing at once send one alert", async () => {
  const { now } = hour();
  const sent = await Promise.all(Array.from({ length: 5 }, () => sendAlert("failure_rate", "S", "T", now)));
  expect(sent.filter(Boolean)).toHaveLength(1);
});

test("alerts at once on a balance or quota code, and not on others", async () => {
  expect(await checkProviderError("video", "DataInspectionFailed")).toBe(false);
  expect(await checkProviderError("video", undefined)).toBe(false);
  expect(sendEmail).not.toHaveBeenCalled();

  expect(await checkProviderError("video", "Arrearage")).toBe(true);
  // Deduped: one an hour, whatever the code.
  expect(await checkProviderError("video", "AllocationQuota.FreeTierOnly")).toBe(false);

  expect(sendEmail).toHaveBeenCalledTimes(2);
  expect(sendEmail.mock.calls[0][0]).toMatchObject({
    subject: "[AIRumpelstiltskinVideo] Bailian balance or quota: Arrearage",
    text: expect.stringContaining("Bailian refused a video job with Arrearage"),
  });
});

test("posts Feishu's own message shape to a Feishu bot", async () => {
  vi.stubEnv("ALERT_WEBHOOK_URL", "https://open.feishu.cn/open-apis/bot/v2/hook/abc");

  await sendAlert("provider_balance", "Subject", "Body", hour().now);

  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    msg_type: "text",
    content: { text: "[AIRumpelstiltskinVideo] Body" },
  });
});

test("only logs without admins or a webhook, and never throws when delivery fails", async () => {
  vi.stubEnv("ADMIN_EMAILS", "");
  vi.stubEnv("ALERT_WEBHOOK_URL", "");
  expect(await sendAlert("failure_rate", "S", "T", hour().now)).toBe(true);
  expect(sendEmail).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();

  await getDb().delete(alert);
  vi.stubEnv("ADMIN_EMAILS", "ops@example.com");
  vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.slack.test/x");
  sendEmail.mockRejectedValueOnce(new Error("Resend down"));
  fetcher.mockRejectedValueOnce(new Error("offline"));
  await expect(sendAlert("failure_rate", "S", "T", hour().now)).resolves.toBe(true);
});
