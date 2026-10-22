import type { PhotoEffect } from "./photo-effects";

// The tip-toe dance, after the Rumpelstiltskin meme: the photo's subject, in
// a cream tailcoat, sneaks through a hay barn, shushes the camera and
// tip-toes, while an onlooker gasps. Bailian wan2.7-r2v makes it from the
// photo and this prompt, with original music. Never name the meme's people
// or song. The prompt fixes the onlooker's look, or the model may change it
// between shots. It sells two qualities at 12 seconds: standard (720P) and
// Pro (1080P). margins.test.ts checks both prices against
// REFERENCE_COST_PER_SECOND. Each account also gets one free 5-second
// preview: three of the shots, at 720P, with Bailian's watermark.
const PROMPT = [
  "Cinematic comedic short film, warm film look, shallow depth of field. A dim wooden barn full of golden hay bales, loose hay on the floor, warm side light.",
  "The star is the person from Image 1: keep exactly the same face, hair, skin tone, age and body. They are now dressed in a cream-white tailcoat with long tails, white vest, black bow tie, cream cropped trousers and black pointed flat shoes.",
  "The onlooker is always the same young woman with long wavy blonde hair in a light blue t-shirt; she sits in the foreground, seen from behind in wide shots and from the front in her close-ups.",
  "Shot 1 medium shot over the onlooker's shoulder: Image 1's person crouches low and sneaks toward the camera on tip-toe.",
  "Shot 2 close-up: the star presses an index finger to their lips, a serious 'shh' gesture, eyes on camera.",
  "Shot 3 close-up: the blonde onlooker covers her mouth with both hands, eyes wide in surprise.",
  "Shot 4 close-up: the star gives a sly mischievous grin.",
  "Shot 5 medium shot: the star spreads both arms wide for balance and does an exaggerated tip-toe dance, big alternating side steps on their toes, coat tails swinging, like a storybook dwarf.",
  "Shot 6 low-angle close-up of only the star's legs and black pointed shoes stepping on tip-toe through the hay.",
  "Shot 7 medium close-up: the star, arms spread, sways left and right with a proud grin.",
  "Fast hard cuts on the beat. Music: an original whimsical fairy-tale tune with pizzicato strings, bassoon and a bouncy beat. No dialogue, no text, no logos, no subtitles.",
].join(" ");

const PREVIEW_PROMPT = [
  "Cinematic comedic short film, warm film look, shallow depth of field. A dim wooden barn full of golden hay bales, warm side light.",
  "The star is the person from Image 1: keep exactly the same face, hair, skin tone, age and body. They are now dressed in a cream-white tailcoat with long tails, white vest, black bow tie, cream cropped trousers and black pointed flat shoes.",
  "Shot 1 medium shot: Image 1's person crouches low and sneaks toward the camera on tip-toe.",
  "Shot 2 close-up: the star presses an index finger to their lips, a sly 'shh', eyes on camera.",
  "Shot 3 medium shot: the star spreads both arms wide and tip-toes side to side with a proud grin, coat tails swinging.",
  "Hard cuts on the beat. Music: an original whimsical fairy-tale tune with pizzicato strings and a bouncy beat. No dialogue, no text, no logos, no subtitles.",
].join(" ");

export const tiptoe = {
  kind: "tiptoe",
  title: "Tip-toe dance",
  photos: 1,
  duration: 12,
  credits: 10,
  prompt: PROMPT,
  resolution: "720P",
  pro: { resolution: "1080P", credits: 20 },
  preview: { resolution: "720P", duration: 5, prompt: PREVIEW_PROMPT },
} as const satisfies PhotoEffect;
