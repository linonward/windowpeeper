import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { auth } from "@/server/auth";
import { user } from "@/server/auth/schema";
import { creditTransaction } from "@/server/credits/schema";
import { getDb } from "@/server/db";
import { order } from "@/server/payment/schema";
import { video } from "@/server/videos/schema";
import { getMetrics, recentMetrics } from "./metrics";

const cleanup: string[] = [];

afterEach(async () => {
  const ctx = await auth.$context;
  // Deleting a user deletes their rows.
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

// Each test counts a window of its own in the past, so rows other tests
// write now never fall in it.
function window() {
  const since = new Date(Date.UTC(2001, 0, 1) + Math.floor(Math.random() * 1e6) * 60_000);
  return { since, until: new Date(since.getTime() + 60 * 60_000), at: (minutes: number) => new Date(since.getTime() + minutes * 60_000) };
}

async function createUser(createdAt?: Date) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { email: `metrics-${randomUUID()}@example.com`, name: "Metrics" },
    { method: "admin" },
  );
  cleanup.push(created.id);
  if (createdAt) await getDb().update(user).set({ createdAt }).where(eq(user.id, created.id));
  return created.id;
}

test("counts users who joined in the window, and every user", async () => {
  const { since, until, at } = window();
  await createUser(at(5));
  await createUser(at(50));
  await createUser(at(70));

  const metrics = await getMetrics({ since, until });

  expect(metrics.users.new).toBe(2);
  expect(metrics.users.total).toBeGreaterThanOrEqual(3);
});

test("sums the credits spent, refunded and bought, less refunded payments, in the window", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const entry = (amount: number, reason: string, minutes: number) => ({
    userId,
    amount,
    reason,
    idempotencyKey: randomUUID(),
    createdAt: at(minutes),
  });
  await getDb()
    .insert(creditTransaction)
    .values([
      entry(-1, "image", 1),
      entry(-20, "video", 2),
      entry(20, "video refund", 3),
      entry(100, "purchase", 4),
      entry(300, "subscription", 5),
      entry(10, "admin", 6),
      entry(-100, "refunded payment", 7),
      entry(-5, "video", 90),
    ]);

  const { credits } = await getMetrics({ since, until });

  expect(credits).toEqual({ spent: 21, refunded: 20, bought: 300 });
});

test("counts orders paid in the window and their revenue per currency", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const paid = (amount: number, currency: string, minutes: number, status: "paid" | "pending" = "paid") => ({
    userId,
    packId: "small",
    credits: 100,
    amount,
    currency,
    status,
    provider: "stripe" as const,
    providerSessionId: randomUUID(),
    createdAt: at(minutes),
    paidAt: status === "paid" ? at(minutes) : null,
  });
  await getDb()
    .insert(order)
    .values([paid(500, "usd", 1), paid(1500, "usd", 2), paid(900, "cny", 3), paid(500, "usd", 4, "pending"), paid(500, "usd", 80)]);

  const { orders } = await getMetrics({ since, until });

  expect(orders).toEqual({
    paid: 3,
    revenue: [
      { currency: "usd", amount: 2000 },
      { currency: "cny", amount: 900 },
    ],
  });
});

test("groups orders paid in the window and their revenue by first-touch source", async () => {
  const { since, until, at } = window();
  const buyer = async (touch: { firstUtmSource?: string; firstReferrer?: string }) => {
    const id = await createUser(at(-10));
    await getDb().update(user).set(touch).where(eq(user.id, id));
    return id;
  };
  const tiktok = await buyer({ firstUtmSource: "TikTok", firstReferrer: "www.google.com/" });
  const tiktokToo = await buyer({ firstUtmSource: "tiktok" });
  const google = await buyer({ firstReferrer: "www.google.com/search" });
  const direct = await buyer({ firstReferrer: "" });
  const paid = (userId: string, amount: number, currency: string, minutes: number) => ({
    userId,
    packId: "small",
    credits: 10,
    amount,
    currency,
    status: "paid" as const,
    provider: "stripe" as const,
    providerSessionId: randomUUID(),
    createdAt: at(minutes),
    paidAt: at(minutes),
  });
  await getDb()
    .insert(order)
    .values([
      paid(tiktok, 499, "usd", 1),
      paid(tiktokToo, 799, "usd", 2),
      paid(tiktokToo, 900, "cny", 3),
      paid(google, 1199, "usd", 4),
      paid(direct, 499, "usd", 5),
      // Outside the window.
      paid(direct, 499, "usd", 80),
      { ...paid(google, 499, "usd", 6), status: "pending" as const, paidAt: null },
    ]);

  const { channels } = await getMetrics({ since, until });

  // utm_source (any case) first, else the referrer's host, else direct.
  expect(channels).toEqual([
    { source: "tiktok", orders: 3, revenue: [{ currency: "usd", amount: 1298 }, { currency: "cny", amount: 900 }] },
    { source: "direct", orders: 1, revenue: [{ currency: "usd", amount: 499 }] },
    { source: "www.google.com", orders: 1, revenue: [{ currency: "usd", amount: 1199 }] },
  ]);
});

test("reports each kind's outcomes, timings and most common failures", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const clip = (status: "pending" | "succeeded" | "failed", minutes: number, seconds?: number, error?: string) => ({
    userId,
    prompt: "x",
    duration: 5,
    provider: "dashscope",
    resolution: "720p",
    credits: 25,
    status,
    error,
    createdAt: at(minutes),
    completedAt: seconds === undefined ? null : new Date(at(minutes).getTime() + seconds * 1000),
  });
  await getDb()
    .insert(video)
    .values([
      clip("succeeded", 1, 10),
      clip("succeeded", 2, 20),
      clip("succeeded", 3, 30),
      clip("succeeded", 4, 40),
      clip("failed", 5, 5, "Bailian 400 DataInspectionFailed"),
      clip("failed", 6, 5, "Bailian 400 DataInspectionFailed"),
      clip("failed", 7, 5, "Never submitted"),
      clip("pending", 8),
      clip("succeeded", 90, 1),
    ]);

  const { generations } = await getMetrics({ since, until });

  expect(generations).toEqual([
    {
      kind: "video",
      total: 8,
      succeeded: 4,
      failed: 3,
      pending: 1,
      medianMs: 25_000,
      p95Ms: 38_500,
      errors: [
        { error: "Bailian 400 DataInspectionFailed", count: 2 },
        { error: "Never submitted", count: 1 },
      ],
    },
  ]);
});

test("estimates each model's cost from the jobs that succeeded", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const clip = (
    status: "succeeded" | "failed",
    minutes: number,
    row: { prompt?: string; credits?: number; provider?: string; resolution?: string; duration?: number } = {},
  ) => ({
    userId,
    prompt: "Window peeper",
    duration: 12,
    provider: "dashscope",
    resolution: "720p",
    credits: 10,
    status,
    createdAt: at(minutes),
    ...row,
  });
  await getDb()
    .insert(video)
    .values([
      // Window peeper videos: 10 credits buy 720p, 20 buy 1080p. One made with
      // animate-move (9 seconds, Pro at 720p) counts as 720P.
      clip("succeeded", 1),
      clip("succeeded", 2),
      clip("succeeded", 3, { resolution: "1080p", credits: 20 }),
      clip("succeeded", 7, { duration: 9, credits: 20 }),
      clip("failed", 4),
      clip("succeeded", 90),
      // Older videos from dropped generators have no price.
      clip("succeeded", 5, { prompt: "The fox runs", credits: 50, duration: 10 }),
      clip("succeeded", 6, { prompt: "The fox runs", provider: "fal", resolution: "1080p", credits: 20, duration: 5 }),
    ]);

  const { costs } = await getMetrics({ since, until });

  const rows = costs.rows.map(({ costUsd, ...row }) => ({ ...row, costUsd: costUsd === null ? null : Number(costUsd.toFixed(6)) }));
  expect(rows).toEqual([
    { kind: "video", model: "dashscope 720p", jobs: 1, usage: 10, credits: 50, costUsd: null },
    { kind: "video", model: "fal 1080p", jobs: 1, usage: 5, credits: 20, costUsd: null },
    { kind: "video", model: "wan2.7-r2v 1080P", jobs: 1, usage: 12, credits: 20, costUsd: 1.8 },
    { kind: "video", model: "wan2.7-r2v 720P", jobs: 3, usage: 33, credits: 40, costUsd: 3.3 },
  ]);
  expect(costs.totalUsd).toBeCloseTo(1.8 + 3.3);
});

test("reports zeros for an empty window", async () => {
  const { since, until } = window();

  const metrics = await getMetrics({ since, until });

  expect(metrics.users.new).toBe(0);
  expect(metrics.credits).toEqual({ spent: 0, refunded: 0, bought: 0 });
  expect(metrics.orders).toEqual({ paid: 0, revenue: [] });
  expect(metrics.channels).toEqual([]);
  expect(metrics.generations).toEqual([
    { kind: "video", total: 0, succeeded: 0, failed: 0, pending: 0, medianMs: null, p95Ms: null, errors: [] },
  ]);
  expect(metrics.costs).toEqual({ rows: [], totalUsd: 0 });
});

// Counts only, as other test files create and delete users meanwhile: a
// user created just now must fall in the window recentMetrics builds.
test("recent metrics count up to now", async () => {
  await createUser();

  expect((await recentMetrics(1)).users.new).toBeGreaterThanOrEqual(1);
  // Not total >= new: the two counts are separate queries, and other test
  // files add and delete users between them.
  expect((await recentMetrics(1)).users.total).toBeGreaterThanOrEqual(1);
});
