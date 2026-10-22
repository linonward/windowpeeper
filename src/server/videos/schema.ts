import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { generationColumns } from "@/server/generations/columns";

// One row per generation. The photo and the MP4 live in object storage; a
// video from a retired two-photo effect also stored its second photo as
// <id>-2.<ext>.
export const video = pgTable(
  "video",
  {
    ...generationColumns(),
    prompt: text("prompt").notNull(),
    // Seconds: a photo effect's duration (PHOTO_EFFECTS); on older rows, 5 or
    // 10 for the dropped image-to-video generator, or TWO_PHOTO_DURATION for
    // a retired two-photo effect.
    duration: integer("duration").notNull(),
    // The provider that took the job; it alone can finish it. "dashscope"
    // (Bailian); older rows may name a dropped provider ("fal", "seeapi").
    provider: text("provider").notNull(),
    // A photo effect's resolution, lowercase ("720p", "1080p"); older rows
    // may have another.
    resolution: text("resolution").notNull(),
    // The frame: "16:9", or "9:16" for a vertical video. Older rows are 16:9.
    ratio: text("ratio").notNull().default("16:9"),
    // Credits spent, and refunded if generation fails.
    credits: integer("credits").notNull(),
    // The provider's request ID, set once the job is submitted.
    requestId: text("request_id"),
    imageKey: text("image_key"),
    // Where a retired effect cut its poster frame, in milliseconds. Nothing
    // sets it now.
    posterMs: integer("poster_ms"),
    // The poster frame, `<id>-poster.jpg`, on older videos only. Kept after
    // the uploads expire.
    posterKey: text("poster_key"),
    // When the user confirmed the photos are theirs, or that the adults in
    // them agreed. POST /api/videos/<kind> requires it; null on older rows
    // and on videos made without photos of people.
    consentedAt: timestamp("consented_at"),
    // The photo effect's scene ("burger", "noodles", ...); null on older rows
    // and for effects without scenes.
    scene: text("scene"),
    // The account's free preview: no credits, short and watermarked.
    preview: boolean("preview").notNull().default(false),
  },
  (table) => [
    index("video_userId_createdAt_idx").on(table.userId, table.createdAt),
    // One free preview per account; a failed one doesn't count.
    uniqueIndex("video_one_preview_idx")
      .on(table.userId)
      .where(sql`${table.preview} and ${table.status} <> 'failed'`),
    // The sweep reads only pending rows, by age.
    index("video_pending_createdAt_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
    // expireUploads reads only rows that still have an upload, by age.
    index("video_upload_createdAt_idx").on(table.createdAt).where(sql`${table.imageKey} is not null`),
  ],
);
