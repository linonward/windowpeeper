import type { PhotoEffect } from "./photo-effects";

// The window peeper trend, a staged comedy bit: the camera creeps toward one
// lit window in a dark apartment block at night, the photo's subject is
// caught eating a burger, freezes, stares into the lens and pulls the
// curtain shut. Bailian wan2.7-r2v makes it from the photo and this prompt,
// with original music. Never name the trend's creators or its sound. The
// subject keeps the outfit from the photo, so the prompt doesn't dress them.
// It sells two qualities at 12 seconds: standard (720P) and Pro (1080P).
// margins.test.ts checks both prices against REFERENCE_COST_PER_SECOND. Each
// account also gets one free 5-second preview: the push-in, the bite and the
// stare, at 720P, with Bailian's watermark.
const PROMPT = [
  "Cinematic comedic short film, handheld night footage shot from across the street, slight film grain. A dark apartment block at night; every window is dark except one, glowing warm yellow.",
  "The person in the lit window is the person from Image 1: keep exactly the same face, hair, skin tone, age, body and clothing.",
  "Shot 1 wide shot: the camera slowly pushes in toward the single lit window.",
  "Shot 2 medium shot through the window glass: Image 1's person sits alone at a small kitchen table and takes a big bite of a burger, relaxed, unaware.",
  "Shot 3 medium close-up: mid-chew, they notice the camera and freeze with the burger still raised.",
  "Shot 4 close-up through the glass: they stare straight into the lens without blinking, for an awkwardly long beat, deadpan.",
  "Shot 5 medium shot: they slowly put the burger down, stand up, and yank the curtain shut.",
  "Shot 6 wide shot: the window glows behind the closed curtain in the dark building.",
  "Music: an original quiet, suspenseful synth tune with a low pulse that cuts out when the curtain closes. No dialogue, no text, no logos, no subtitles.",
].join(" ");

const PREVIEW_PROMPT = [
  "Cinematic comedic short film, handheld night footage shot from across the street. A dark apartment block at night with one window glowing warm yellow.",
  "The person in the lit window is the person from Image 1: keep exactly the same face, hair, skin tone, age, body and clothing.",
  "Shot 1 wide shot: the camera slowly pushes in toward the lit window.",
  "Shot 2 medium shot through the glass: Image 1's person takes a big bite of a burger at a small kitchen table.",
  "Shot 3 close-up: mid-chew, they freeze and stare straight into the lens, deadpan.",
  "Music: an original quiet, suspenseful synth tune with a low pulse. No dialogue, no text, no logos, no subtitles.",
].join(" ");

export const windowpeeper = {
  kind: "windowpeeper",
  title: "Window peeper",
  photos: 1,
  duration: 12,
  credits: 10,
  prompt: PROMPT,
  resolution: "720P",
  pro: { resolution: "1080P", credits: 20 },
  preview: { resolution: "720P", duration: 5, prompt: PREVIEW_PROMPT },
} as const satisfies PhotoEffect;
