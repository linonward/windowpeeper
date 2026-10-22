import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type VideoResponse } from "@/lib/api";
import { InsufficientCreditsError } from "@/server/credits";
import { log } from "@/server/log";
import {
  ContentBlockedError,
  createEffectVideo,
  InvalidImageSizeError,
  InvalidVideoRequestError,
  ModerationUnavailableError,
  photoEffect,
  PreviewUsedError,
  refreshVideo,
  VIDEO_QUALITIES,
  VIDEO_RATIOS,
  VideosDisabledError,
} from "@/server/videos";

type Params = Awaited<RouteContext<"/api/videos/[id]">["params"]>;

// Copying a finished MP4 to storage can take a while.
export const maxDuration = 120;

// Returns { video }, after asking its provider about it if it's still pending.
export const GET = withSession<Params>(async (_request, { session, params }) => {
  const { id } = params;
  try {
    const video = await refreshVideo(session.user.id, id);
    if (!video) return apiError("VIDEO_NOT_FOUND", 404);
    return Response.json({ video } satisfies VideoResponse);
  } catch (error) {
    // The video stays pending; the next poll tries again.
    log.error("video.refresh_failed", { id, error });
    return apiError("REFRESH_FAILED", 502);
  }
}, { limit: LIMITS.videoPoll });

// POST /api/videos/<kind> queues one photo effect video (PHOTO_EFFECTS):
// here the segment is the effect's kind, which never looks like a video ID.
// Multipart body: image1, the photo; optional quality, "standard" (the
// default), "pro" for an effect that sells Pro (the window peeper video), or
// "preview" for the account's one free preview (409 PREVIEW_USED after); optional
// ratio, "16:9" (the default) or "9:16" for a vertical video; and consent,
// "yes" when the user confirmed the photos are theirs or that the adults in
// them agreed: without it, 400 before anything is stored or spent. The row
// records when. Returns { video }
// with status "pending"; poll GET /api/videos/<id> until it finishes. Any
// other segment is 404.
export const POST = withSession<Params>(async (request, { session, params }) => {
  const effect = photoEffect(params.id);
  if (!effect) return apiError("NOT_FOUND", 404);
  const form = await request.formData().catch(() => null);
  const images = Array.from({ length: effect.photos }, (_, index) => form?.get(`image${index + 1}`));
  if (!images.every((image): image is File => image instanceof File)) {
    return apiError("INVALID_REQUEST", 400);
  }
  const quality = VIDEO_QUALITIES.find((value) => value === (form?.get("quality") ?? "standard"));
  if (!quality) return apiError("INVALID_REQUEST", 400);
  const ratio = VIDEO_RATIOS.find((value) => value === (form?.get("ratio") ?? "16:9"));
  if (!ratio) return apiError("INVALID_REQUEST", 400);
  if (form?.get("consent") !== "yes") return apiError("INVALID_REQUEST", 400);

  try {
    const video = await createEffectVideo({
      userId: session.user.id,
      kind: effect.kind,
      quality,
      ratio,
      consentedAt: new Date(),
      images: await Promise.all(images.map(async (image) => new Uint8Array(await image.arrayBuffer()))),
    });
    return Response.json({ video } satisfies VideoResponse);
  } catch (error) {
    if (error instanceof InvalidImageSizeError) {
      return apiError("INVALID_IMAGE_SIZE", 400);
    }
    if (error instanceof InvalidVideoRequestError) {
      return apiError("INVALID_REQUEST", 400);
    }
    if (error instanceof InsufficientCreditsError) {
      return apiError("INSUFFICIENT_CREDITS", 402);
    }
    if (error instanceof PreviewUsedError) {
      return apiError("PREVIEW_USED", 409);
    }
    if (error instanceof ContentBlockedError) {
      log.info("video.blocked", { userId: session.user.id, reason: error.message });
      return apiError("CONTENT_BLOCKED", 422);
    }
    if (error instanceof ModerationUnavailableError) {
      log.error("video.moderation_failed", { userId: session.user.id, error });
      return apiError("MODERATION_UNAVAILABLE", 503);
    }
    if (error instanceof VideosDisabledError) {
      return apiError("VIDEOS_DISABLED", 503);
    }
    log.error("video.submit_failed", { userId: session.user.id, error });
    return apiError("GENERATION_FAILED", 502);
  }
});
