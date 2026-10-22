import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, inArray, isNotNull, lt, not, sql } from "drizzle-orm";
import {
  getEffectVideoProvider,
  getVideoProvider,
  type VideoRatio,
  type VideoResolution,
  VideoGenerationError,
} from "@/server/ai/video";
import { user } from "@/server/auth/schema";
import { getBalance, InsufficientCreditsError } from "@/server/credits";
import { getDb } from "@/server/db";
import { type Email, sendEmail } from "@/server/email/client";
import { videoFailedEmail, videoReadyEmail } from "@/server/email/templates/video";
import { lifecycle } from "@/server/generations";
import { log } from "@/server/log";
import { ContentBlockedError } from "@/server/moderation";
import { checkImage, imageModerationEnabled, ModerationUnavailableError } from "@/server/moderation/image";
import { deleteObject, putObject, signedUrl, storageConfigured } from "@/server/storage";
import {
  EFFECT_IMAGE_LIMITS,
  EFFECT_MAX_IMAGE_BYTES,
  REFERENCE_COST_PER_SECOND,
  TWO_PHOTO_DURATION,
  UPLOAD_EXPIRY_BATCH,
  UPLOAD_RETENTION_MS,
  VIDEO_GIVE_UP_AFTER_MS,
  VIDEO_STALE_AFTER_MS,
  VIDEO_SWEEP_BATCH,
  VIDEOS_PAGE_SIZE,
} from "./config";
import {
  PHOTO_EFFECTS,
  type PhotoEffect,
  photoEffect,
  type PhotoEffectKind,
  VIDEO_RATIOS,
  type VideoQuality,
} from "./photo-effects";
import { checkImageSize, type ImageLimits, imageSize } from "./image-size";
import { video } from "./schema";

export class VideosDisabledError extends Error {
  constructor() {
    super("Video generation is off: set DASHSCOPE_API_KEY and the STORAGE_* variables");
  }
}

export class InvalidVideoRequestError extends Error {}

// The account has had its free preview: one pending or made. A failed one
// doesn't count.
export class PreviewUsedError extends Error {
  constructor() {
    super("The free preview is used");
  }
}

// The photo's pixel size is outside what the provider accepts.
export class InvalidImageSizeError extends Error {
  constructor(readonly limits: ImageLimits) {
    super(`Each side must be ${limits.minSide}-${limits.maxSide} pixels, at most ${limits.maxRatio}:1`);
  }
}

export { ContentBlockedError, ModerationUnavailableError };
export {
  PHOTO_EFFECTS,
  photoEffect,
  type PhotoEffectKind,
  VIDEO_QUALITIES,
  VIDEO_RATIOS,
  type VideoQuality,
} from "./photo-effects";
export type { VideoRatio } from "@/server/ai/video";

// Bailian's codes for an input its moderation refused.
const BLOCKED_CODES = new Set(["DataInspectionFailed", "IPInfringementSuspect"]);

// What a row whose provider was dropped (fal, seeapi) polls: no provider can
// finish its job, so it fails and refunds like any failed job.
const DROPPED_PROVIDER = "DroppedProvider";

export type Video = {
  id: string;
  prompt: string;
  duration: number;
  resolution: string;
  // "16:9", or "9:16" for a vertical video.
  ratio: string;
  // Credits spent, refunded if the video failed.
  credits: number;
  // The account's free preview: short and watermarked.
  preview: boolean;
  // The photo effect's scene, or null on older videos.
  scene: string | null;
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
  // Signed URLs, valid for an hour. url is null until the MP4 is stored.
  url: string | null;
  imageUrl: string | null;
  // The frame an older video's effect cut for its poster; else the player
  // shows imageUrl.
  posterUrl: string | null;
};

type Row = typeof video.$inferSelect;

const videos = lifecycle({
  name: "video",
  table: video,
  jobColumn: video.requestId,
  jobId: (row) => row.requestId,
  credits: (row) => row.credits,
  // The provider that took the job.
  poll: async (row, requestId) => {
    const provider = getVideoProvider(row.provider);
    if (!provider) {
      return { status: "failed", code: DROPPED_PROVIDER, error: `Provider ${row.provider} was removed` };
    }
    return provider.result(requestId);
  },
  output: { ext: "mp4", mime: "video/mp4", timeoutMs: 120_000, error: (message) => new VideoGenerationError(message) },
  notification: {
    succeeded: (row) => ({ type: "video_succeeded", data: { videoId: row.id, prompt: row.prompt } }),
    failed: (row, credits) => ({ type: "video_failed", data: { videoId: row.id, prompt: row.prompt, credits } }),
  },
  unwatched: {
    succeeded: (row) => emailOwner(row.userId, (to, base) => videoReadyEmail(to, row.prompt, `${base}/videos/${row.id}`)),
    failed: (row, credits) =>
      emailOwner(row.userId, (to, base) => videoFailedEmail(to, row.prompt, credits, `${base}/videos`)),
  },
  neverFinished: "Provider never finished",
  stale: { afterMs: VIDEO_STALE_AFTER_MS, giveUpAfterMs: VIDEO_GIVE_UP_AFTER_MS, batch: VIDEO_SWEEP_BATCH },
});

// A provider's moderation refusal becomes ContentBlockedError.
function blocked(error: unknown): unknown {
  return error instanceof VideoGenerationError && error.code && BLOCKED_CODES.has(error.code)
    ? new ContentBlockedError(error.message, { cause: error })
    : error;
}

// A photo effect needs Bailian and storage.
function effectEnabled() {
  return getEffectVideoProvider() !== null && storageConfigured();
}

// `credits` is the standard price; `proCredits` the Pro one, or null for an
// effect that sells only standard.
export function effectOptions(kind: PhotoEffectKind): { enabled: boolean; credits: number; proCredits: number | null } {
  const effect = photoEffect(kind) as PhotoEffect;
  return { enabled: effectEnabled(), credits: effect.credits, proCredits: effect.pro?.credits ?? null };
}

// A photo effect's photo becomes its video, in the quality bought (standard
// by default), the scene picked (the effect's first by default) and the ratio
// picked (16:9 by default): Bailian wan2.7-r2v makes the scene's prompt into a video
// that stars the photo's subject. An unknown kind, the wrong number
// of photos, an unknown scene, or Pro or a preview for an effect without it, is an
// InvalidVideoRequestError. A preview is free, once per account (a second is
// PreviewUsedError), with the effect's preview prompt, seconds and watermark.
// `consentedAt` is when the user confirmed they may use the photo; the row
// keeps it. Stored and finished like any video: the photo is its image, and
// the "dashscope" provider polls the job.
export async function createEffectVideo(input: {
  userId: string;
  kind: string;
  images: Uint8Array[];
  quality?: VideoQuality;
  ratio?: VideoRatio;
  scene?: string;
  consentedAt?: Date;
}): Promise<Video> {
  const effect = photoEffect(input.kind);
  if (!effect || input.images.length !== effect.photos) {
    throw new InvalidVideoRequestError(`${input.kind} takes ${effect?.photos ?? 0} photos`);
  }
  const pro = input.quality === "pro" ? effect.pro : undefined;
  if (input.quality === "pro" && !pro) throw new InvalidVideoRequestError(`${input.kind} has no Pro quality`);
  const preview = input.quality === "preview" ? effect.preview : undefined;
  if (input.quality === "preview" && !preview) throw new InvalidVideoRequestError(`${input.kind} has no preview`);
  const scene = effect.scenes
    ? effect.scenes.find((each) => each.id === (input.scene ?? effect.scenes?.[0].id))
    : undefined;
  if (effect.scenes ? !scene : input.scene !== undefined) {
    throw new InvalidVideoRequestError(`${input.kind} has no scene ${input.scene}`);
  }
  const ratio = input.ratio ?? "16:9";
  if (!VIDEO_RATIOS.includes(ratio)) throw new InvalidVideoRequestError(`${ratio} isn't a video ratio`);
  const provider = getEffectVideoProvider();
  if (!provider) throw new VideosDisabledError();
  const [bytes] = input.images;
  const type = imageType(bytes);
  if (!type || bytes.byteLength > EFFECT_MAX_IMAGE_BYTES) {
    throw new InvalidVideoRequestError(`Each photo must be a JPEG, PNG or WebP up to ${EFFECT_MAX_IMAGE_BYTES} bytes`);
  }
  if (!storageConfigured()) throw new VideosDisabledError();
  assertImageSize(bytes, EFFECT_IMAGE_LIMITS);

  const { userId } = input;
  if (preview && (await hasLivePreview(userId))) throw new PreviewUsedError();
  const credits = preview ? 0 : (pro?.credits ?? effect.credits);
  const resolution = preview?.resolution ?? pro?.resolution ?? effect.resolution;
  const duration = preview?.duration ?? effect.duration;
  const id = randomUUID();
  const imageKey = videos.fileKey(userId, id, type.ext);
  const files = [{ key: imageKey, bytes, mime: type.mime }];
  const moderated = await storeAndCheck(userId, id, credits, files);
  const db = getDb();
  try {
    const row = await videos.start(
      { userId, id, credits },
      (tx) =>
        tx.insert(video).values({
          id,
          userId,
          prompt: effect.title,
          duration,
          provider: provider.id,
          resolution: resolution.toLowerCase(),
          ratio,
          credits,
          consentedAt: input.consentedAt ?? null,
          preview: Boolean(preview),
          scene: scene?.id ?? null,
        }),
      async () => {
        if (!moderated) await storeFiles(files);
        const requestId = await provider.submit({
          image: { bytes, mime: type.mime, url: await signedUrl(imageKey) },
          prompt: preview?.prompt ?? scene?.prompt ?? effect.prompt,
          resolution,
          ratio,
          watermark: Boolean(preview),
          duration,
        });
        const [submitted] = await db
          .update(video)
          .set({ requestId, imageKey })
          .where(eq(video.id, id))
          .returning();
        return submitted;
      },
    );
    return withUrls(row);
  } catch (error) {
    // Two previews at once: the database let one through.
    const refused = isPreviewConflict(error) ? new PreviewUsedError() : error;
    if (moderated) await removeUnpaid(refused, files);
    throw blocked(refused);
  }
}

// A preview of the user's that is pending or made.
async function hasLivePreview(userId: string): Promise<boolean> {
  const [found] = await getDb()
    .select({ id: video.id })
    .from(video)
    .where(and(eq(video.userId, userId), eq(video.preview, true), not(eq(video.status, "failed"))))
    .limit(1);
  return Boolean(found);
}

// Postgres refused the insert for video_one_preview_idx.
function isPreviewConflict(error: unknown): boolean {
  for (let cause = error; cause; cause = (cause as { cause?: unknown }).cause) {
    const { code, constraint } = cause as { code?: string; constraint?: string };
    if (code === "23505" && constraint === "video_one_preview_idx") return true;
  }
  return false;
}

type StoredFile = { key: string; bytes: Uint8Array; mime: string };

// Emails the video's owner. The links have no locale: the app redirects
// them to the reader's. A lost email is logged, never thrown.
async function emailOwner(userId: string, email: (to: string, base: string) => Email) {
  try {
    const [found] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (!found) return;
    await sendEmail(email(found.email, new URL(process.env.BETTER_AUTH_URL ?? "").origin));
  } catch (error) {
    log.error("video.email_failed", { userId, error });
  }
}

async function storeFiles(files: StoredFile[]) {
  for (const { key, bytes, mime } of files) await putObject(key, bytes, mime);
}

async function removeFiles(files: StoredFile[]) {
  for (const { key } of files) {
    await deleteObject(key).catch((error) => log.error("video.image_not_deleted", { key, error }));
  }
}

// With IMAGE_MODERATION on, stores the uploaded images and checks each one
// before anything is spent; a flagged image, or a check that gives no
// verdict, deletes them all and throws. Returns whether it stored them, so
// the submission doesn't store them again.
async function storeAndCheck(userId: string, id: string, credits: number, files: StoredFile[]): Promise<boolean> {
  if (!imageModerationEnabled()) return false;
  // Spending checks again; this only spares an upload that can't be paid for.
  if ((await getBalance(userId)) < credits) throw new InsufficientCreditsError();
  await storeFiles(files);
  try {
    for (const [index, file] of files.entries()) {
      await checkImage(await signedUrl(file.key), index === 0 ? `video:${id}` : `video:${id}:${index + 1}`);
    }
  } catch (error) {
    await removeFiles(files);
    throw error;
  }
  return true;
}

// Spending failed before the job existed, so the checked images have no row.
async function removeUnpaid(error: unknown, files: StoredFile[]) {
  if (error instanceof InsufficientCreditsError || error instanceof PreviewUsedError) await removeFiles(files);
}

// Returns the user's video, first asking its provider about a pending one.
// A finished video is copied to storage; a failed one is refunded. Null if
// not found. Throws if the provider or storage fails, leaving the video
// pending for a retry.
export async function refreshVideo(userId: string, id: string): Promise<Video | null> {
  const row = await videos.refresh(userId, id);
  return row ? withUrls(row) : null;
}

// Returns the user's video as stored, without asking its provider. Null if
// not found.
export async function getVideo(userId: string, id: string): Promise<Video | null> {
  const row = await videos.get(userId, id);
  return row ? withUrls(row) : null;
}

// A signed URL that downloads the user's stored video as a file. Null if
// not found or not stored.
export async function videoDownloadUrl(userId: string, id: string): Promise<string | null> {
  const key = await videos.storedKey(userId, id);
  return key ? signedUrl(key, { download: `video-${id}.mp4` }) : null;
}

// Settles videos left pending: fails and refunds those never submitted (a
// crash) or that their provider hasn't finished in a day, and collects
// finished ones nobody polled for. Returns how many it failed and checked.
export function sweepStaleVideos(now = new Date()): Promise<{ failed: number; checked: number }> {
  return videos.sweep(now);
}

// The extensions imageType gives, for the second photo of a retired
// two-photo effect's video, whose key isn't stored. Deleting a key that
// doesn't exist succeeds.
const IMAGE_EXTS = ["jpg", "png", "webp"];

// Deletes uploaded photos older than UPLOAD_RETENTION_MS, oldest first, and
// clears the video's imageKey; the MP4 stays. A video whose upload can't be
// deleted keeps its key, so a later run retries. Returns how many videos it
// cleared.
export async function expireUploads(now = new Date()): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: video.id, userId: video.userId, imageKey: video.imageKey, duration: video.duration })
    .from(video)
    .where(and(isNotNull(video.imageKey), lt(video.createdAt, new Date(now.getTime() - UPLOAD_RETENTION_MS))))
    .orderBy(asc(video.createdAt))
    .limit(UPLOAD_EXPIRY_BATCH);

  let cleared = 0;
  for (const row of rows) {
    const keys = [row.imageKey as string];
    // Only the retired two-photo effects' videos are TWO_PHOTO_DURATION long.
    if (row.duration === TWO_PHOTO_DURATION) {
      keys.push(...IMAGE_EXTS.map((ext) => videos.fileKey(row.userId, `${row.id}-2`, ext)));
    }
    try {
      for (const key of keys) await deleteObject(key);
    } catch (error) {
      log.error("video.upload_not_deleted", { id: row.id, error });
      continue;
    }
    await db.update(video).set({ imageKey: null }).where(eq(video.id, row.id));
    cleared++;
  }
  return cleared;
}

// Finished videos only.
export function countVideos(userId: string): Promise<number> {
  return videos.count(userId);
}

export async function listVideos(userId: string, limit = 24): Promise<Video[]> {
  return Promise.all((await videos.list(userId, limit)).map(withUrls));
}

// One page of the user's videos, newest first. `total` counts them all, so
// the page can link to the rest.
export async function pageVideos(
  userId: string,
  page = 1,
  pageSize = VIDEOS_PAGE_SIZE,
): Promise<{ videos: Video[]; total: number }> {
  const { rows, total } = await videos.page(userId, page, pageSize);
  return { videos: await Promise.all(rows.map(withUrls)), total };
}

// How videos created between `since` and `until` went, for /admin/metrics.
export function videoMetrics(window: { since: Date; until: Date }) {
  return videos.metrics(window);
}

// Videos that succeeded between `since` and `until` (failed ones aren't
// billed), per model: their seconds, the credits they spent and their cost.
// A photo effect's video is priced at REFERENCE_COST_PER_SECOND for its
// resolution, as "wan2.7-r2v <resolution>". Effect videos made before it
// (wan2.2-animate-move, 720p) count as 720P. Older videos, from dropped
// generators, show as "<provider> <resolution>" without a price (null).
export async function videoCosts({ since, until }: { since: Date; until: Date }) {
  const db = getDb();
  const succeeded = and(eq(video.status, "succeeded"), gte(video.createdAt, since), lt(video.createdAt, until));
  const totals = {
    videos: count(),
    seconds: sql<number>`coalesce(sum(${video.duration}), 0)`.mapWith(Number),
    credits: sql<number>`coalesce(sum(${video.credits}), 0)`.mapWith(Number),
  };
  const effectRow = and(eq(video.provider, "dashscope"), inArray(video.prompt, PHOTO_EFFECTS.map((e) => e.title)));
  const [effects, older] = await Promise.all([
    db
      .select({ resolution: video.resolution, ...totals })
      .from(video)
      .where(and(succeeded, effectRow))
      .groupBy(video.resolution),
    db
      .select({ provider: video.provider, resolution: video.resolution, ...totals })
      .from(video)
      .where(and(succeeded, not(effectRow as NonNullable<typeof effectRow>)))
      .groupBy(video.provider, video.resolution),
  ]);

  const models = new Map<string, { model: string; videos: number; seconds: number; credits: number; costUsd: number | null }>();
  const add = (model: string, row: { videos: number; seconds: number; credits: number }, costUsd: number | null) => {
    const entry = models.get(model) ?? { model, videos: 0, seconds: 0, credits: 0, costUsd: null };
    entry.videos += row.videos;
    entry.seconds += row.seconds;
    entry.credits += row.credits;
    if (costUsd !== null) entry.costUsd = (entry.costUsd ?? 0) + costUsd;
    models.set(model, entry);
  };
  for (const row of effects) {
    const resolution = effectResolution(row.resolution);
    if (resolution) add(`wan2.7-r2v ${resolution}`, row, REFERENCE_COST_PER_SECOND[resolution] * row.seconds);
    else add(`dashscope ${row.resolution}`, row, null);
  }
  for (const row of older) add(`${row.provider} ${row.resolution}`, row, null);
  return [...models.values()].sort((a, b) => a.model.localeCompare(b.model));
}

// The priced resolution of a photo effect's row ("720p" is 720P). Null for
// one Bailian doesn't price.
function effectResolution(stored: string): VideoResolution | null {
  const resolution = stored.toUpperCase();
  return resolution in REFERENCE_COST_PER_SECOND ? (resolution as VideoResolution) : null;
}

async function withUrls(row: Row): Promise<Video> {
  return {
    id: row.id,
    prompt: row.prompt,
    duration: row.duration,
    resolution: row.resolution,
    ratio: row.ratio,
    credits: row.credits,
    preview: row.preview,
    scene: row.scene,
    status: row.status,
    createdAt: row.createdAt,
    url: row.status === "succeeded" && row.storageKey ? await signedUrl(row.storageKey) : null,
    imageUrl: row.imageKey ? await signedUrl(row.imageKey) : null,
    posterUrl: row.posterKey ? await signedUrl(row.posterKey) : null,
  };
}

// Before anything is stored or spent: a provider would fail the job anyway.
function assertImageSize(bytes: Uint8Array, limits: ImageLimits) {
  const size = imageSize(bytes);
  if (!size) throw new InvalidVideoRequestError("The image's size can't be read");
  if (!checkImageSize(size, limits)) throw new InvalidImageSizeError(limits);
}

// Detects the type from the file's first bytes, not the name the browser sent.
function imageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  // "RIFF" .... "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

// Deletes the user's stored MP4s and photos. Their rows go with the user.
export function deleteUserVideos(userId: string): Promise<void> {
  return videos.deleteUserFiles(userId);
}
