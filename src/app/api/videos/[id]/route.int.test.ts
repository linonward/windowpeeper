import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getBalance, grantCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { video } from "@/server/videos/schema";

// POST /api/videos/<kind> with a real database. The session, the motion
// provider and storage are fakes; src/server/videos/index.int.test.ts covers
// the rest of making the video.
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/server/auth/session", () => ({ getSession: async () => ({ user: { id: session.userId } }) }));
const { motion, storage } = vi.hoisted(() => ({
  motion: { id: "dashscope" as const, submit: vi.fn(async () => "dashscope-motion-1") },
  storage: {
    storageConfigured: () => true,
    putObject: vi.fn(async () => {}),
    deleteObject: vi.fn(async () => {}),
    signedUrl: async (key: string) => `https://storage.test/${key}?signed`,
  },
}));
vi.mock("@/server/ai/video", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEffectVideoProvider: () => motion,
}));
vi.mock("@/server/storage", () => storage);

const { POST } = await import("./route");

// A JPEG header with a readable size.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 720 >> 8, 720 & 0xff, 1280 >> 8, 1280 & 0xff, 3]);

beforeEach(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Dancer" },
    { method: "admin" },
  );
  session.userId = user.id;
  await grantCredits({ userId: user.id, amount: 20, reason: "test", idempotencyKey: randomUUID() });
});

afterEach(async () => {
  // Deleting the user deletes their jobs, so finished jobs don't linger in
  // the last hour the failure-rate alert reads (src/server/alerts).
  await (await auth.$context).internalAdapter.deleteUser(session.userId);
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function post(fields: Record<string, string>, image = jpeg) {
  const form = new FormData();
  form.set("image1", new File([image], "me.jpg", { type: "image/jpeg" }));
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  const origin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
  return POST(new Request(`${origin}/api/videos/windowpeeper`, { method: "POST", body: form, headers: { origin } }), {
    params: Promise.resolve({ id: "windowpeeper" }),
  });
}

const rows = () => getDb().select().from(video).where(eq(video.userId, session.userId));

test.each<Record<string, string>>([{}, { consent: "no" }, { consent: "" }])(
  "without consent=yes (%o), answers 400 and stores or spends nothing",
  async (fields) => {
    const response = await post(fields);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(await getBalance(session.userId)).toBe(20);
    expect(await rows()).toEqual([]);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(motion.submit).not.toHaveBeenCalled();
  },
);

test("with consent=yes, makes the video and records when consent was given", async () => {
  const before = new Date();

  const response = await post({ consent: "yes", quality: "standard" });

  expect(response.status).toBe(200);
  expect(await getBalance(session.userId)).toBe(10);
  const [row] = await rows();
  expect(row.consentedAt).toBeInstanceOf(Date);
  expect(row.consentedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  expect(row.consentedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
});

test("ratio=9:16 makes a vertical video; the ratio defaults to 16:9", async () => {
  expect((await post({ consent: "yes", ratio: "9:16" })).status).toBe(200);
  expect(motion.submit).toHaveBeenLastCalledWith(expect.objectContaining({ ratio: "9:16" }));
  expect((await post({ consent: "yes" })).status).toBe(200);
  expect(motion.submit).toHaveBeenLastCalledWith(expect.objectContaining({ ratio: "16:9" }));
});

test("quality=preview makes the free preview once; the second answers 409 PREVIEW_USED", async () => {
  expect((await post({ consent: "yes", quality: "preview" })).status).toBe(200);
  expect(await getBalance(session.userId)).toBe(20);

  const again = await post({ consent: "yes", quality: "preview" });

  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: "PREVIEW_USED" });
});

test("an unknown ratio answers 400 and stores or spends nothing", async () => {
  const response = await post({ consent: "yes", ratio: "1:1" });

  expect(response.status).toBe(400);
  expect(await getBalance(session.userId)).toBe(20);
  expect(await rows()).toEqual([]);
  expect(storage.putObject).not.toHaveBeenCalled();
});

// The browser shrinks a photo to fit 4 MB, under Vercel's 4.5 MB request
// body limit (src/lib/shrink-photo.ts).
const jpegOfBytes = (bytes: number) => {
  const padded = new Uint8Array(bytes).fill(0xff);
  padded.set(jpeg);
  return padded;
};

test("takes a 3.5 MB photo", async () => {
  const response = await post({ consent: "yes" }, jpegOfBytes(3.5 * 1024 * 1024));

  expect(response.status).toBe(200);
  expect(await rows()).toHaveLength(1);
});

test("refuses a photo over 4 MB with 400, and stores or spends nothing", async () => {
  const response = await post({ consent: "yes" }, jpegOfBytes(4 * 1024 * 1024 + 1));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
  expect(await getBalance(session.userId)).toBe(20);
  expect(await rows()).toEqual([]);
  expect(storage.putObject).not.toHaveBeenCalled();
});
