// The classes that size a video player to its ratio: full width for 16:9,
// and a tall frame for a 9:16 video, centered and no taller than most of
// the screen.
export function playerFrame(ratio: string): string {
  return ratio === "9:16" ? "mx-auto aspect-[9/16] max-h-[75svh] w-auto max-w-full" : "aspect-video w-full";
}
