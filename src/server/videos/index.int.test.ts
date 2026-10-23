import { randomUUID } from "node:crypto";
import { asc, eq, like } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReferenceVideoJob, VideoResult } from "@/server/ai/video";
import { auth } from "@/server/auth";
import { user } from "@/server/auth/schema";
import { getBalance, grantCredits, InsufficientCreditsError, spendCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import type { Email } from "@/server/email/client";
import { creditTransaction } from "@/server/credits/schema";
import { pageNotifications } from "@/server/notifications";
import { notification } from "@/server/notifications/schema";
import { VIDEO_STALE_AFTER_MS } from "./config";
import { video } from "./schema";

// Fake Bailian and storage. Their own tests cover the HTTP calls.
const { ai, storage } = vi.hoisted(() => {
  class VideoGenerationError extends Error {
    constructor(
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  }
  const dashscope = {
    id: "dashscope" as const,
    result: vi.fn<(requestId: string) => Promise<VideoResult>>(async () => ({ status: "pending" })),
  };
  const state = { motion: true };
  const motion = {
    id: "dashscope" as const,
    submit: vi.fn<(job: ReferenceVideoJob) => Promise<string>>(async () => "dashscope-motion-1"),
  };
  return {
    ai: {
      dashscope,
      motion,
      state,
      module: {
        VideoGenerationError,
        // Like the real one: a dropped provider (fal, seeapi) has none.
        getVideoProvider: (id: string) => (id === "dashscope" ? dashscope : null),
        getEffectVideoProvider: () => (state.motion ? motion : null),
      },
    },
    storage: {
      storageConfigured: vi.fn(() => true),
      putObject: vi.fn<(key: string, body: Uint8Array, type: string) => Promise<void>>(async () => {}),
      deleteObject: vi.fn<(key: string) => Promise<void>>(async () => {}),
      signedUrl: vi.fn(
        async (key: string, options?: { download?: string }) =>
          `https://storage.test/${key}?signed${options?.download ? `&download=${options.download}` : ""}`,
      ),
    },
  };
});
vi.mock("@/server/ai/video", () => ai.module);
vi.mock("@/server/storage", () => storage);
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<(email: Email) => Promise<void>>(async () => {}) }));
vi.mock("@/server/email/client", () => ({ sendEmail }));
// alerts/index.int.test.ts covers sending and deduping the alert.
const { checkProviderError } = vi.hoisted(() => ({ checkProviderError: vi.fn(async () => false) }));
vi.mock("@/server/alerts", () => ({ checkProviderError }));
// The image check's own tests cover SeeAPI's API.
const moderation = vi.hoisted(() => ({
  enabled: vi.fn(() => false),
  checkImage: vi.fn<(url: string, key: string) => Promise<void>>(async () => {}),
}));
vi.mock("@/server/moderation/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/moderation/image")>()),
  imageModerationEnabled: moderation.enabled,
  checkImage: moderation.checkImage,
}));
const { ModerationUnavailableError } = await import("@/server/moderation/image");

const {
  createEffectVideo,
  effectOptions,
  countVideos,
  refreshVideo,
  sweepStaleVideos,
  expireUploads,
  listVideos,
  pageVideos,
  getVideo,
  videoDownloadUrl,
  VideosDisabledError,
  InvalidVideoRequestError,
  InvalidImageSizeError,
  ContentBlockedError,
  PreviewUsedError,
} = await import("./index");

const { dashscope } = ai;
// Images with a readable size: a PNG header up to IHDR, and a JPEG with a
// frame header. image-size.test.ts covers reading them.
const be32 = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const pngOf = (width: number, height: number) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
const jpegOf = (width: number, height: number) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3]);
const png = pngOf(1280, 720);
const jpeg = jpegOf(1280, 720);
const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
let userId: string;

beforeEach(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Director" },
    { method: "admin" },
  );
  userId = user.id;
  // Enough for several window peeper videos on top of the signup credits.
  await grantCredits({ userId, amount: 80, reason: "test", idempotencyKey: randomUUID() });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(mp4, { headers: { "content-type": "video/mp4" } })));
});

afterEach(async () => {
  // Deleting the user deletes their jobs, so finished jobs don't linger in
  // the last hour the failure-rate alert reads (src/server/alerts).
  await (await auth.$context).internalAdapter.deleteUser(userId);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  ai.state.motion = true;
  dashscope.result.mockResolvedValue({ status: "pending" });
  storage.storageConfigured.mockReturnValue(true);
  moderation.enabled.mockReturnValue(false);
});

const rows = () => getDb().select().from(video).where(eq(video.userId, userId));
const create = (image: Uint8Array = jpeg, quality?: "standard" | "pro" | "preview", ratio?: "16:9" | "9:16") =>
  createEffectVideo({ userId, kind: "windowpeeper", images: [image], quality, ratio });

test("with image moderation on, checks the stored photo before spending", async () => {
  moderation.enabled.mockReturnValue(true);
  const before = await getBalance(userId);

  const result = await create();

  const imageKey = `videos/${userId}/${result.id}.jpg`;
  expect(storage.putObject).toHaveBeenCalledTimes(1);
  expect(storage.putObject).toHaveBeenCalledWith(imageKey, jpeg, "image/jpeg");
  expect(moderation.checkImage).toHaveBeenCalledExactlyOnceWith(`https://storage.test/${imageKey}?signed`, `video:${result.id}`);
  expect(ai.motion.submit).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ image: expect.objectContaining({ url: `https://storage.test/${imageKey}?signed` }) }),
  );
  expect(await getBalance(userId)).toBe(before - 10);
  expect(storage.deleteObject).not.toHaveBeenCalled();
});

test.each([
  ["a flagged photo is blocked", () => new ContentBlockedError("The image was flagged: explicit"), ContentBlockedError],
  ["a check that fails refuses the upload", () => new ModerationUnavailableError("timed out"), ModerationUnavailableError],
])("%s: spends nothing, records nothing and deletes the photo", async (_, error, type) => {
  moderation.enabled.mockReturnValue(true);
  moderation.checkImage.mockRejectedValueOnce(error());
  const before = await getBalance(userId);

  await expect(create()).rejects.toBeInstanceOf(type);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toEqual([]);
  expect(ai.motion.submit).not.toHaveBeenCalled();
  const keys = storage.putObject.mock.calls.map(([key]) => key);
  expect(keys).toHaveLength(1);
  expect(storage.deleteObject.mock.calls.map(([key]) => key)).toEqual(keys);
});

test("with image moderation on, a user without enough credits uploads nothing", async () => {
  moderation.enabled.mockReturnValue(true);
  const balance = await getBalance(userId);
  await spendCredits({ userId, amount: balance - 9, reason: "test", idempotencyKey: randomUUID() });

  await expect(create()).rejects.toThrow(InsufficientCreditsError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(moderation.checkImage).not.toHaveBeenCalled();
});

test.each([
  ["194×259, under 240 pixels", pngOf(194, 259)],
  ["9000×2000, over 8000 pixels", pngOf(9000, 2000)],
  ["2000×240, wider than 8:1", pngOf(2000, 240)],
] as const)("rejects a photo of %s, before uploading or spending", async (_, image) => {
  const before = await getBalance(userId);

  await expect(create(image)).rejects.toBeInstanceOf(InvalidImageSizeError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(ai.motion.submit).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toBe(before);
});

test("accepts a photo at Bailian's limits", async () => {
  await expect(create(pngOf(240, 240))).resolves.toMatchObject({ status: "pending" });
});

test("refunds and records the failure when Bailian rejects the job", async () => {
  const before = await getBalance(userId);
  ai.motion.submit.mockRejectedValueOnce(new ai.module.VideoGenerationError("Bailian 401"));

  await expect(create()).rejects.toThrow("Bailian 401");

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: "Bailian 401" }]);
});

test.each(["DataInspectionFailed", "IPInfringementSuspect"])(
  "reports a Bailian moderation refusal (%s) as blocked, refunded",
  async (code) => {
    const before = await getBalance(userId);
    ai.motion.submit.mockRejectedValueOnce(new ai.module.VideoGenerationError("Bailian 400", code));

    await expect(create()).rejects.toThrow(ContentBlockedError);

    expect(await getBalance(userId)).toBe(before);
    expect(await rows()).toMatchObject([{ status: "failed", error: "Bailian 400", credits: 10 }]);
  },
);

test("passes the provider's code of a refused submission to the balance alert", async () => {
  ai.motion.submit.mockRejectedValueOnce(new ai.module.VideoGenerationError("Bailian 400 Arrearage", "Arrearage"));

  await expect(create()).rejects.toThrow("Arrearage");

  expect(checkProviderError).toHaveBeenCalledExactlyOnceWith("video", "Arrearage");
});

test("passes the provider's code of a failed job to the balance alert, once", async () => {
  const created = await create();
  dashscope.result.mockResolvedValue({ status: "failed", code: "Arrearage", error: "task failed" });

  await refreshVideo(userId, created.id);
  await refreshVideo(userId, created.id);

  expect(checkProviderError).toHaveBeenCalledExactlyOnceWith("video", "Arrearage");
});

test("refresh keeps a running video pending", async () => {
  const created = await create();

  const result = await refreshVideo(userId, created.id);

  expect(dashscope.result).toHaveBeenCalledWith("dashscope-motion-1");
  expect(result).toMatchObject({ id: created.id, status: "pending", url: null });
});

test("refresh copies a finished video to storage", async () => {
  const created = await create();
  dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });

  const result = await refreshVideo(userId, created.id);

  const key = `videos/${userId}/${created.id}.mp4`;
  expect(fetch).toHaveBeenCalledWith("https://dashscope.test/out.mp4", expect.anything());
  expect(storage.putObject).toHaveBeenCalledWith(key, mp4, "video/mp4");
  expect(result).toMatchObject({ status: "succeeded", url: `https://storage.test/${key}?signed` });
  expect(await rows()).toMatchObject([{ status: "succeeded", storageKey: key }]);

  // A finished video isn't checked again.
  await refreshVideo(userId, created.id);
  expect(dashscope.result).toHaveBeenCalledTimes(1);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "video_succeeded", data: { videoId: created.id, prompt: "Window peeper" } },
  ]);
});

test("counts only the user's finished videos", async () => {
  const done = await create();
  await create();
  dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  await refreshVideo(userId, done.id);

  expect(await countVideos(userId)).toBe(1);
  expect(await countVideos(randomUUID())).toBe(0);
});

test("refresh refunds what was spent on a failed video, once", async () => {
  const before = await getBalance(userId);
  const created = await create(jpeg, "pro");
  dashscope.result.mockResolvedValue({ status: "failed", code: "FAILED", error: "Bailian task failed" });

  const result = await refreshVideo(userId, created.id);
  await refreshVideo(userId, created.id);

  expect(result).toMatchObject({ status: "failed", url: null });
  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: "Bailian task failed" }]);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "video_failed", data: { videoId: created.id, prompt: "Window peeper", credits: 20 } },
  ]);
});

test("keeps the credit and notification keys that videos in flight rely on", async () => {
  const created = await create(jpeg, "pro");
  dashscope.result.mockResolvedValue({ status: "failed", code: "FAILED", error: "Bailian task failed" });
  await refreshVideo(userId, created.id);

  expect(await ledger(created.id)).toEqual({
    credits: [
      { key: `video:${created.id}`, reason: "video", amount: -20 },
      { key: `video-refund:${created.id}`, reason: "video refund", amount: 20 },
    ],
    notes: [{ key: `video:${created.id}`, type: "video_failed" }],
  });
});

// The image-to-video generator's providers are gone. Production had no such
// rows; one still pending fails and refunds on its next poll.
test.each(["fal", "seeapi"])("a pending %s video from the dropped generator fails and refunds", async (provider) => {
  const before = await getBalance(userId);
  const id = randomUUID();
  await spendCredits({ userId, amount: 20, reason: "video", idempotencyKey: `video:${id}` });
  await getDb().insert(video).values({
    id,
    userId,
    prompt: "The fox runs",
    duration: 5,
    provider,
    resolution: "480p",
    credits: 20,
    requestId: `${provider}-req-1`,
  });

  expect(await refreshVideo(userId, id)).toMatchObject({ status: "failed" });

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: `Provider ${provider} was removed` }]);
  expect(dashscope.result).not.toHaveBeenCalled();
});

test("refresh leaves the video pending when copying it fails, so a later refresh retries", async () => {
  const created = await create();
  dashscope.result.mockResolvedValue({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  storage.putObject.mockRejectedValueOnce(new Error("bucket gone"));

  await expect(refreshVideo(userId, created.id)).rejects.toThrow("bucket gone");
  expect(await rows()).toMatchObject([{ status: "pending" }]);

  expect(await refreshVideo(userId, created.id)).toMatchObject({ status: "succeeded" });
});

test("refresh finds only the user's own videos", async () => {
  const created = await create();

  expect(await refreshVideo(randomUUID(), created.id)).toBeNull();
  expect(await refreshVideo(userId, randomUUID())).toBeNull();
});

test("without enough credits, calls nothing and records nothing", async () => {
  const balance = await getBalance(userId);
  await spendCredits({ userId, amount: balance - 9, reason: "test", idempotencyKey: randomUUID() });

  await expect(create()).rejects.toThrow(InsufficientCreditsError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(ai.motion.submit).not.toHaveBeenCalled();
  expect(await rows()).toEqual([]);
});

test("is off without Bailian or storage", async () => {
  ai.state.motion = false;
  await expect(create()).rejects.toThrow(VideosDisabledError);

  ai.state.motion = true;
  storage.storageConfigured.mockReturnValue(false);
  await expect(create()).rejects.toThrow(VideosDisabledError);
  expect(storage.putObject).not.toHaveBeenCalled();
});

test("lists only the user's videos, newest first, signing only stored ones", async () => {
  const first = await create();
  dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  await refreshVideo(userId, first.id);
  const second = await create();

  const list = await listVideos(userId);

  expect(list.map((v) => v.id)).toEqual([second.id, first.id]);
  expect(list[0]).toMatchObject({ status: "pending", url: null, imageUrl: expect.any(String) });
  expect(list[1]).toMatchObject({ id: first.id, url: expect.stringContaining(`${first.id}.mp4`) });
  expect(list[0]).not.toHaveProperty("error");
  expect(list[0]).not.toHaveProperty("provider");
  expect(await listVideos(randomUUID())).toEqual([]);
});

test("pages through the user's videos, newest first, counting them all", async () => {
  const first = await create();
  const second = await create();
  const third = await create();

  const one = await pageVideos(userId, 1, 2);
  const two = await pageVideos(userId, 2, 2);

  expect(one.total).toBe(3);
  expect(one.videos.map((v) => v.id)).toEqual([third.id, second.id]);
  expect(two).toMatchObject({ total: 3, videos: [{ id: first.id, imageUrl: expect.any(String) }] });
  expect(await pageVideos(userId, 3, 2)).toEqual({ videos: [], total: 3 });
  expect(await pageVideos(randomUUID())).toEqual({ videos: [], total: 0 });
});

async function finishedVideo() {
  const created = await create();
  dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  return (await refreshVideo(userId, created.id))!;
}

test("gets one of the user's videos without asking the provider", async () => {
  const done = await finishedVideo();
  const pending = await create();
  dashscope.result.mockClear();

  expect(await getVideo(userId, done.id)).toMatchObject({ id: done.id, url: expect.stringContaining(done.id) });
  expect(await getVideo(userId, pending.id)).toMatchObject({ status: "pending", url: null });
  expect(dashscope.result).not.toHaveBeenCalled();
  expect(await getVideo(randomUUID(), done.id)).toBeNull();
  expect(await getVideo(userId, "not-an-id")).toBeNull();
});

test("signs a download only for the user's stored videos", async () => {
  const done = await finishedVideo();
  const pending = await create();

  expect(await videoDownloadUrl(userId, done.id)).toBe(
    `https://storage.test/videos/${userId}/${done.id}.mp4?signed&download=video-${done.id}.mp4`,
  );
  expect(await videoDownloadUrl(userId, pending.id)).toBeNull();
  expect(await videoDownloadUrl(randomUUID(), done.id)).toBeNull();
});

// A video whose request crashed (no requestId) or whose page was closed.
async function staleVideo(minutesAgo: number, requestId: string | null) {
  const id = randomUUID();
  await spendCredits({ userId, amount: 20, reason: "video", idempotencyKey: `video:${id}` });
  await getDb().insert(video).values({
    id,
    userId,
    prompt: "Lost",
    duration: 5,
    provider: "dashscope",
    resolution: "720p",
    credits: 20,
    requestId,
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  });
  return id;
}

const statusOf = async (id: string) =>
  (await getDb().select({ status: video.status }).from(video).where(eq(video.id, id)))[0]?.status;

test("the sweep fails and refunds a video that was never submitted, once", async () => {
  const before = await getBalance(userId);
  const stale = await staleVideo(20, null);
  const fresh = await staleVideo(1, null);

  await sweepStaleVideos();
  await sweepStaleVideos();

  expect(await statusOf(stale)).toBe("failed");
  expect(await statusOf(fresh)).toBe("pending");
  expect(await getBalance(userId)).toBe(before - 20);
});

test("the sweep collects a finished video nobody polled", async () => {
  dashscope.result.mockResolvedValue({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  // A second past the stale age, so it's the newest stale video: the sweep
  // takes only the newest VIDEO_SWEEP_BATCH, and earlier runs leave pending
  // videos in the shared database that turn stale later.
  const id = await staleVideo(VIDEO_STALE_AFTER_MS / 60_000 + 1 / 60, `dashscope-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("succeeded");
  expect(storage.putObject).toHaveBeenCalledWith(`videos/${userId}/${id}.mp4`, mp4, "video/mp4");
});

// Bailian takes about 6m40s for a 14-second video, so the sweep looks soon
// after: a closed page gets its video within one cron run of that.
test("the sweep collects a video seven minutes after it was made", async () => {
  dashscope.result.mockResolvedValue({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  const id = await staleVideo(7 + 1 / 60, `dashscope-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("succeeded");
});

// Emails sent to this test's user. The database is shared, so the sweep
// may settle other tests' videos too. The links need the site URL, which
// CI has no .env for.
const emailsToUser = async () => {
  const [{ email }] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
  return sendEmail.mock.calls.map(([sent]) => sent).filter((sent) => sent.to === email);
};

test("the sweep emails the owner of a video nobody was watching, once", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  dashscope.result.mockResolvedValue({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  const id = await staleVideo(VIDEO_STALE_AFTER_MS / 60_000 + 1 / 60, `dashscope-${randomUUID()}`);

  await sweepStaleVideos();
  await refreshVideo(userId, id);

  const sent = await emailsToUser();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ subject: expect.stringContaining("video is ready") });
  expect(sent[0]).toMatchObject({ text: expect.stringContaining(`/videos/${id}`) });
});

test("the sweep emails the owner when it gives up on a video", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  const id = await staleVideo(25 * 60, `dashscope-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("failed");
  const sent = await emailsToUser();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ text: expect.stringContaining("20 credits were refunded") });
});

test("a video the user's page collects sends no email", async () => {
  const created = await create();
  dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });

  await refreshVideo(userId, created.id);

  expect(await statusOf(created.id)).toBe("succeeded");
  expect(await emailsToUser()).toEqual([]);
});

test("a lost email doesn't stop the sweep", async () => {
  sendEmail.mockRejectedValue(new Error("Resend down"));
  dashscope.result.mockResolvedValue({ status: "succeeded", url: "https://dashscope.test/out.mp4" });
  const id = await staleVideo(VIDEO_STALE_AFTER_MS / 60_000 + 1 / 60, `dashscope-${randomUUID()}`);

  await expect(sweepStaleVideos()).resolves.toBeDefined();

  expect(await statusOf(id)).toBe("succeeded");
  sendEmail.mockReset();
  sendEmail.mockImplementation(async () => {});
});

test("the sweep gives up on a provider job after a day and refunds it", async () => {
  const before = await getBalance(userId);
  const id = await staleVideo(25 * 60, `dashscope-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("failed");
  expect(await getBalance(userId)).toBe(before);
});

// Jobs still in flight during a deploy settle with these keys and reasons,
// so changing one would spend, refund or notify twice.
async function ledger(id: string) {
  const db = getDb();
  const credits = await db
    .select({ key: creditTransaction.idempotencyKey, reason: creditTransaction.reason, amount: creditTransaction.amount })
    .from(creditTransaction)
    .where(like(creditTransaction.idempotencyKey, `%:${id}`))
    .orderBy(asc(creditTransaction.createdAt));
  const notes = await db
    .select({ key: notification.key, type: notification.type })
    .from(notification)
    .where(like(notification.key, `%:${id}`));
  return { credits, notes };
}

// A video whose uploads were stored `hoursAgo`. The database is shared, so
// tests look only at their own rows and run the sweep until it is done.
async function uploadedVideo(hoursAgo: number, { twoPhotos = false } = {}) {
  const id = randomUUID();
  await getDb()
    .insert(video)
    .values({
      id,
      userId,
      prompt: "Old",
      duration: twoPhotos ? 15 : 5,
      provider: "dashscope",
      resolution: "720p",
      credits: 20,
      status: "succeeded",
      requestId: "req",
      imageKey: `videos/${userId}/${id}.jpg`,
      createdAt: new Date(Date.now() - hoursAgo * 60 * 60_000),
    });
  return id;
}

async function expireAll() {
  for (let i = 0; i < 50 && (await expireUploads()) > 0; i++);
}

const imageKeyOf = async (id: string) =>
  (await getDb().select({ imageKey: video.imageKey }).from(video).where(eq(video.id, id)))[0]?.imageKey;

test("deletes uploads after a day, keeping the video and newer uploads", async () => {
  const old = await uploadedVideo(25);
  const fresh = await uploadedVideo(23);

  await expireAll();

  expect(await imageKeyOf(old)).toBeNull();
  expect(await imageKeyOf(fresh)).toBe(`videos/${userId}/${fresh}.jpg`);
  const deleted = storage.deleteObject.mock.calls.map(([key]) => key);
  expect(deleted).toContain(`videos/${userId}/${old}.jpg`);
  expect(deleted.filter((key) => key.includes(fresh))).toEqual([]);
  expect(await statusOf(old)).toBe("succeeded");
});

// The retired two-photo effects' videos last TWO_PHOTO_DURATION.
test("deletes a retired two-photo effect's second photo too, whatever its type", async () => {
  const id = await uploadedVideo(25, { twoPhotos: true });

  await expireAll();

  const deleted = storage.deleteObject.mock.calls.map(([key]) => key).filter((key) => key.includes(id));
  expect(deleted.sort()).toEqual(
    [`${id}.jpg`, `${id}-2.jpg`, `${id}-2.png`, `${id}-2.webp`].map((name) => `videos/${userId}/${name}`).sort(),
  );
  expect(await imageKeyOf(id)).toBeNull();
});

test("an upload that can't be deleted keeps its key, so a later run retries", async () => {
  const id = await uploadedVideo(25);
  storage.deleteObject.mockImplementation(async (key) => {
    if (key.includes(id)) throw new Error("storage down");
  });

  await expireUploads();

  expect(await imageKeyOf(id)).toBe(`videos/${userId}/${id}.jpg`);
  storage.deleteObject.mockImplementation(async () => {});
  await expireAll();
  expect(await imageKeyOf(id)).toBeNull();
});


test.each([
  ["an unknown effect", "not-an-effect", [jpeg]],
  ["two photos for a one-photo effect", "windowpeeper", [jpeg, png]],
] as const)("%s spends nothing", async (_, kind, images) => {
  const before = await getBalance(userId);

  await expect(createEffectVideo({ userId, kind, images: [...images] })).rejects.toThrow(InvalidVideoRequestError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toBe(before);
});

test("the window peeper video is on with a Bailian key and storage", () => {
  expect(effectOptions("windowpeeper")).toEqual({ enabled: true, credits: 10, proCredits: 20 });
  ai.state.motion = false;
  expect(effectOptions("windowpeeper").enabled).toBe(false);
  ai.state.motion = true;
  storage.storageConfigured.mockReturnValue(false);
  expect(effectOptions("windowpeeper").enabled).toBe(false);
});

test("a window peeper video stores one photo, queues one 14-second 720P job with the effect's prompt and spends 10 credits", async () => {
  const before = await getBalance(userId);

  const result = await create();

  const photo = `videos/${userId}/${result.id}.jpg`;
  expect(storage.putObject).toHaveBeenCalledWith(photo, jpeg, "image/jpeg");
  expect(ai.motion.submit).toHaveBeenCalledWith({
    image: { bytes: jpeg, mime: "image/jpeg", url: `https://storage.test/${photo}?signed` },
    prompt: expect.stringContaining("Image 1"),
    resolution: "720P",
    ratio: "16:9",
    watermark: false,
    duration: 14,
  });
  expect(result).toMatchObject({
    prompt: "Window peeper",
    duration: 14,
    resolution: "720p",
    ratio: "16:9",
    credits: 10,
    status: "pending",
  });
  expect(await getBalance(userId)).toBe(before - 10);
  expect(await rows()).toMatchObject([{ provider: "dashscope", requestId: "dashscope-motion-1", imageKey: photo }]);
});

test("a Pro window peeper video queues a 1080P job and spends 20 credits", async () => {
  const before = await getBalance(userId);

  const result = await create(jpeg, "pro");

  expect(ai.motion.submit).toHaveBeenCalledWith(expect.objectContaining({ resolution: "1080P" }));
  expect(result).toMatchObject({ prompt: "Window peeper", resolution: "1080p", credits: 20, status: "pending" });
  expect(await getBalance(userId)).toBe(before - 20);
});

test("a vertical window peeper video queues a 9:16 job at the same price and keeps its ratio", async () => {
  const before = await getBalance(userId);

  const result = await create(jpeg, "pro", "9:16");

  expect(ai.motion.submit).toHaveBeenCalledWith(expect.objectContaining({ resolution: "1080P", ratio: "9:16" }));
  expect(result).toMatchObject({ resolution: "1080p", ratio: "9:16", credits: 20 });
  expect(await getBalance(userId)).toBe(before - 20);
  expect(await rows()).toMatchObject([{ ratio: "9:16" }]);
});

test("a window peeper video is the burger scene unless another is picked", async () => {
  const result = await create();

  expect(ai.motion.submit).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("burger") }));
  expect(result.scene).toBe("burger");
  expect(await rows()).toMatchObject([{ scene: "burger" }]);
});

test.each([
  ["noodles", "noodles"],
  ["pizza", "pizza"],
  ["wave", "polite wave"],
  ["glass", "rain"],
  ["couple", "partner"],
])("the %s scene queues its own prompt at the same price and keeps the scene", async (scene, word) => {
  const before = await getBalance(userId);

  const result = await createEffectVideo({ userId, kind: "windowpeeper", images: [jpeg], scene });

  const { prompt } = ai.motion.submit.mock.calls[0][0];
  expect(prompt).toContain("Image 1");
  expect(prompt.toLowerCase()).toContain(word);
  expect(result).toMatchObject({ scene, duration: 14, credits: 10 });
  expect(await getBalance(userId)).toBe(before - 10);
});

test("an unknown scene is refused before anything is stored or spent", async () => {
  const before = await getBalance(userId);

  await expect(createEffectVideo({ userId, kind: "windowpeeper", images: [jpeg], scene: "sushi" })).rejects.toThrow(
    InvalidVideoRequestError,
  );

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toBe(before);
});

test("an unknown ratio is refused before anything is stored or spent", async () => {
  const before = await getBalance(userId);

  await expect(create(jpeg, "standard", "1:1" as "16:9")).rejects.toThrow(InvalidVideoRequestError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toBe(before);
});

test("a free preview queues a short watermarked 720P job, spends no credits and is marked a preview", async () => {
  const before = await getBalance(userId);

  const result = await create(jpeg, "preview", "9:16");

  expect(ai.motion.submit).toHaveBeenCalledWith(
    expect.objectContaining({ resolution: "720P", ratio: "9:16", duration: 5, watermark: true }),
  );
  expect(result).toMatchObject({ duration: 5, resolution: "720p", credits: 0, preview: true, status: "pending" });
  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ preview: true, credits: 0 }]);
  const ledger = await getDb().select().from(creditTransaction).where(eq(creditTransaction.userId, userId));
  expect(ledger.filter((entry) => entry.reason.startsWith("video"))).toEqual([]);
});

test("paid videos aren't watermarked", async () => {
  await create();

  expect(ai.motion.submit).toHaveBeenCalledWith(expect.objectContaining({ watermark: false }));
});

test("an account gets one free preview: a second is refused before anything is stored", async () => {
  await create(jpeg, "preview");
  vi.mocked(storage.putObject).mockClear();
  ai.motion.submit.mockClear();

  await expect(create(jpeg, "preview")).rejects.toThrow(PreviewUsedError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(ai.motion.submit).not.toHaveBeenCalled();
  expect(await rows()).toHaveLength(1);
});

test("a preview that failed doesn't use up the free preview, and refunds nothing", async () => {
  ai.motion.submit.mockRejectedValueOnce(new ai.module.VideoGenerationError("Bailian 500"));
  await expect(create(jpeg, "preview")).rejects.toThrow();
  const before = await getBalance(userId);

  await create(jpeg, "preview");

  expect(await getBalance(userId)).toBe(before);
  expect((await rows()).map((row) => row.status).sort()).toEqual(["failed", "pending"]);
});

test("the database refuses a second live preview even when two arrive together", async () => {
  const results = await Promise.allSettled([create(jpeg, "preview"), create(jpeg, "preview")]);

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")?.reason).toBeInstanceOf(PreviewUsedError);
  expect((await rows()).filter((row) => row.status !== "failed")).toHaveLength(1);
});

test("a window peeper video finishes through the dashscope provider, like any video", async () => {
  const created = await create();
  dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });

  const result = await refreshVideo(userId, created.id);

  expect(dashscope.result).toHaveBeenCalledWith("dashscope-motion-1");
  expect(result).toMatchObject({ status: "succeeded" });
});

// A readable JPEG header, padded to the given size.
const jpegOfBytes = (bytes: number) => {
  const padded = new Uint8Array(bytes).fill(0xff);
  padded.set(jpeg);
  return padded;
};

test("a window peeper video takes a 3.5 MB photo, under the 4 MB upload limit", async () => {
  await expect(create(jpegOfBytes(3.5 * 1024 * 1024))).resolves.toMatchObject({ status: "pending" });
});

test.each([
  ["a photo that isn't an image", new Uint8Array([1, 2, 3])],
  ["a photo over 4 MB", jpegOfBytes(4 * 1024 * 1024 + 1)],
  ["a photo whose size can't be read", png.slice(0, 12)],
] as const)("a window peeper video rejects %s and spends nothing", async (_, image) => {
  const before = await getBalance(userId);

  await expect(create(image)).rejects.toThrow(InvalidVideoRequestError);

  expect(await getBalance(userId)).toBe(before);
  expect(ai.motion.submit).not.toHaveBeenCalled();
});

test("a window peeper video's photo is deleted after a day, without looking for a second", async () => {
  const { id } = await create();
  await getDb()
    .update(video)
    .set({ createdAt: new Date(Date.now() - 25 * 60 * 60_000) })
    .where(eq(video.id, id));

  await expireAll();

  const deleted = storage.deleteObject.mock.calls.map(([key]) => key);
  expect(deleted).toContain(`videos/${userId}/${id}.jpg`);
  expect(deleted.filter((key) => key.includes(`${id}-2`))).toEqual([]);
  expect(await imageKeyOf(id)).toBeNull();
});
