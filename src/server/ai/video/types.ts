export class VideoGenerationError extends Error {
  constructor(
    message: string,
    // The provider's error code, such as Bailian's "DataInspectionFailed".
    readonly code?: string,
  ) {
    super(message);
    this.name = "VideoGenerationError";
  }
}

// A video that stars the photo's subject: Bailian's wan2.7-r2v makes it
// from the photo, as "Image 1", and a prompt that names it so. The photo
// goes as a signed URL.
export type ReferenceVideoJob = {
  image: { bytes: Uint8Array; mime: string; url: string };
  prompt: string;
  resolution: VideoResolution;
  ratio: VideoRatio;
  // Bailian's own "AI generated" mark, for free previews.
  watermark: boolean;
  // Seconds, 2 to 15.
  duration: number;
};

// 1080P costs more per second than 720P.
export type VideoResolution = "720P" | "1080P";

// Landscape, or vertical for short-video apps.
export type VideoRatio = "16:9" | "9:16";

export type VideoResult =
  | { status: "pending" }
  | { status: "succeeded"; url: string }
  | { status: "failed"; code?: string; error: string };

// Polls the jobs a provider took.
export interface VideoProvider {
  id: "dashscope";
  // Checks a queued video. Throws if the provider can't answer, so the
  // caller can retry later.
  result(requestId: string): Promise<VideoResult>;
}
