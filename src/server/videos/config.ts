import type { VideoResolution } from "@/server/ai/video";
import type { ImageLimits } from "./image-size";

// What Bailian charges per second of wan2.7-r2v output with sound, in
// dollars, by resolution (Singapore region; Beijing charges less). The photo
// is not billed. margins.test.ts checks each photo effect's price against it.
export const REFERENCE_COST_PER_SECOND: Record<VideoResolution, number> = {
  "720P": 0.1,
  "1080P": 0.15,
};

// The largest photo a visitor may pick, as the copy states it. The browser
// shrinks it (src/lib/shrink-photo.ts) to fit EFFECT_MAX_IMAGE_BYTES.
export const EFFECT_MAX_PICK_BYTES = 10 * 1024 * 1024;

// The largest photo the server takes. Vercel refuses a function request
// body over 4.5 MB, so this leaves room for the rest of the multipart body.
export const EFFECT_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Each photo effect photo, as Bailian accepts it: 240-8000 pixels a side,
// 1:8 to 8:1. A photo outside these limits is turned away before it spends
// credits, instead of failing at Bailian.
export const EFFECT_IMAGE_LIMITS: ImageLimits = { minSide: 240, maxSide: 8000, maxRatio: 8 };

// The length of every video made by the retired two-photo effects (the rap
// duo, zombie couple, hug and raindance duo). They stored their second photo
// as <id>-2.<ext>, which expireUploads still deletes for those rows.
export const TWO_PHOTO_DURATION = 15;

// Videos per page of /videos/library.
export const VIDEOS_PAGE_SIZE = 24;

// The request that submits a video finishes within seconds, so one still
// unsubmitted after this was abandoned by a crash. Submitted videos older
// than this get collected even if nobody has the page open. Bailian takes
// about 6m40s for a 14-second video, so the sweep looks just after that.
export const VIDEO_STALE_AFTER_MS = 7 * 60_000;

// Providers finish within minutes; a job still pending after this is lost.
export const VIDEO_GIVE_UP_AFTER_MS = 24 * 60 * 60_000;

// Uploaded photos (photo effect photos, and older videos' start images) are
// deleted this long after upload. Providers fetch them at submission. The
// privacy policy states it.
export const UPLOAD_RETENTION_MS = 24 * 60 * 60_000;

// Videos whose uploads one sweep deletes.
export const UPLOAD_EXPIRY_BATCH = 100;

// Pending videos the sweep asks providers about per run.
export const VIDEO_SWEEP_BATCH = 20;
