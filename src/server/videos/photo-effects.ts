import type { VideoRatio, VideoResolution } from "@/server/ai/video";
import { windowpeeper } from "./window-peeper";

// A photo effect: one photo and no words from the user become one video
// (createEffectVideo). Bailian wan2.7-r2v makes the effect's prompt into a
// video that stars the photo's subject, as "Image 1". Each effect's file
// exports its definition; list it here. POST /api/videos/<kind> and
// /videos/<kind> serve every effect in the list. The UI's list of kinds is
// PHOTO_EFFECT_KINDS (src/lib/photo-effects.ts), its copy PhotoEffects.kinds
// in messages/*.json; src/test/photo-effects.test.ts checks both.
export type PhotoEffect = {
  kind: string;
  // What the video list shows in place of a prompt.
  title: string;
  photos: 1;
  // Seconds, 2 to 15.
  duration: number;
  credits: number;
  // What happens in the video. It calls the photo's subject "Image 1".
  prompt: string;
  // The resolution `credits` buys. With `pro`, the effect also sells the Pro
  // quality: another resolution at its own price.
  resolution: VideoResolution;
  pro?: { resolution: VideoResolution; credits: number };
  // A free, short, watermarked take, once per account: its own resolution,
  // seconds and prompt (a shorter story for the shorter clip).
  preview?: { resolution: VideoResolution; duration: number; prompt: string };
};

export const PHOTO_EFFECTS = [windowpeeper] as const satisfies readonly PhotoEffect[];

export type PhotoEffectKind = (typeof PHOTO_EFFECTS)[number]["kind"];

// What the buyer picks for an effect with `pro`: standard
// (`resolution`, `credits`) or Pro (`pro`). Every effect sells standard.
// "preview" is the free take of an effect with `preview`.
export const VIDEO_QUALITIES = ["standard", "pro", "preview"] as const;

export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

// The frame the buyer picks, at the same price: 16:9 (the default) or 9:16
// for TikTok, Reels and Shorts.
export const VIDEO_RATIOS = ["16:9", "9:16"] as const satisfies readonly VideoRatio[];

export function photoEffect(kind: string): PhotoEffect | null {
  return PHOTO_EFFECTS.find((effect) => effect.kind === kind) ?? null;
}
