import type { PhotoEffect } from "./photo-effects";

// The window peeper trend, a staged comedy bit: the camera creeps toward one
// lit window in a dark apartment block at night, the photo's subject is
// caught eating a burger, freezes, stares into the lens and pulls the
// curtain shut; five more scenes change the food, the weather, the company
// or the ending. Bailian wan2.7-r2v makes it from the photo and the scene's prompt,
// with original music. Never name the trend's creators or its sound. The
// subject keeps the outfit from the photo, so the prompt doesn't dress them.
// It sells two qualities at 14 seconds: standard (720P) and Pro (1080P).
// margins.test.ts checks both prices against REFERENCE_COST_PER_SECOND. Each
// account also gets one free 5-second preview: the push-in, the bite and the
// stare, at 720P, with Bailian's watermark. In test generations the camera
// drifted into the room, so the prompts keep every shot outside, through
// the glass; window-peeper.test.ts checks it.

// What every scene shares: the night street, the lit window seen from
// outside, the subject and the music. Each scene adds its own shots.
const OPENING = [
  "Cinematic comedic short film, handheld night footage shot from across the street with a long zoom lens, slight film grain. A dark apartment block at night; every window is dark except one, glowing warm yellow.",
  "Every shot is filmed from outside, through that window: the dark window frame and faint reflections on the glass stay visible at the edges of every frame. The camera never enters the room.",
  "The person in the lit window is the person from Image 1: keep exactly the same face, hair, skin tone, age, body and clothing.",
  "Shot 1 wide shot: the camera slowly zooms in toward the single lit window.",
];
const MUSIC =
  "Music: an original quiet, suspenseful synth tune with a low pulse that cuts out at the end. No dialogue, no text, no logos, no subtitles.";
const scene = (...shots: string[]) => [...OPENING, ...shots, MUSIC].join(" ");

// The six windows the buyer picks from, the original first. Each id is
// stored on the video (video.scene) and named in PhotoEffects.scenes in
// messages/*.json; src/test/photo-effects.test.ts checks both.
export const SCENES = [
  {
    id: "burger",
    prompt: scene(
      "Shot 2 medium shot through the window glass: Image 1's person sits alone at a small kitchen table and takes a big bite of a burger, relaxed, unaware.",
      "Shot 3 medium close-up through the glass: mid-chew, with a bite missing from the burger, they notice the camera and freeze with the burger still raised.",
      "Shot 4 tight zoomed close-up through the glass, window frame visible: they stare straight into the lens without blinking, for an awkwardly long beat, deadpan.",
      "Shot 5 medium shot through the glass: they put the burger down, stand up, grab the curtain with one hand and yank it shut across the window in one quick motion, on screen.",
      "Shot 6 wide shot: the window glows behind the closed curtain in the dark building.",
    ),
  },
  {
    id: "noodles",
    prompt: scene(
      "Shot 2 medium shot through the window glass: Image 1's person sits alone at a small kitchen table with a steaming bowl of noodles and slurps a big mouthful with chopsticks, relaxed, unaware.",
      "Shot 3 medium close-up through the glass: noodles still hanging from their mouth, they notice the camera and freeze.",
      "Shot 4 tight zoomed close-up through the glass, window frame visible: they stare straight into the lens without blinking, for an awkwardly long beat, deadpan.",
      "Shot 5 medium shot through the glass: they slowly put the chopsticks down, stand up, grab the curtain and yank it shut across the window in one quick motion, on screen.",
      "Shot 6 wide shot: the window glows behind the closed curtain in the dark building.",
    ),
  },
  {
    id: "pizza",
    prompt: scene(
      "Shot 2 medium shot through the window glass: Image 1's person sits alone on a couch with an open pizza box and takes a big bite of a pizza slice, the cheese stretching, relaxed, unaware.",
      "Shot 3 medium close-up through the glass: mid-chew, they notice the camera and freeze with the slice still raised.",
      "Shot 4 tight zoomed close-up through the glass, window frame visible: they stare straight into the lens without blinking, for an awkwardly long beat, deadpan.",
      "Shot 5 medium shot through the glass: they slowly put the slice down, stand up, grab the curtain and yank it shut across the window in one quick motion, on screen.",
      "Shot 6 wide shot: the window glows behind the closed curtain in the dark building.",
    ),
  },
  {
    id: "wave",
    prompt: scene(
      "Shot 2 medium shot through the window glass: Image 1's person sits alone at a small kitchen table and takes a big bite of a burger, relaxed, unaware.",
      "Shot 3 medium close-up through the glass: mid-chew, they notice the camera and freeze.",
      "Shot 4 tight zoomed close-up through the glass, window frame visible: they stare straight into the lens without blinking, for an awkwardly long beat, deadpan.",
      "Shot 5 medium shot through the glass: still chewing and still staring, they slowly raise one hand; the person waves at the lens, a small polite wave.",
      "Shot 6 wide shot: the person keeps waving in the lit window of the dark building.",
    ),
  },
  {
    id: "glass",
    prompt: scene(
      "Rain runs down the window glass the whole time, droplets catching the warm light.",
      "Shot 2 medium shot through the wet glass: Image 1's person sits alone at a small kitchen table and takes a big bite of a burger, relaxed, unaware, blurred a little by the rain on the glass.",
      "Shot 3 medium close-up through the glass: mid-chew, they notice the camera and freeze.",
      "Shot 4 tight zoomed close-up through the rainy glass, window frame visible: they lean toward the window and stare straight into the lens without blinking, for an awkwardly long beat, deadpan.",
      "Shot 5 medium shot through the glass: they slowly stand up, grab the curtain and yank it shut across the window in one quick motion, on screen.",
      "Shot 6 wide shot: rain falls past the window glowing behind the closed curtain.",
    ),
  },
  {
    id: "couple",
    prompt: scene(
      "Shot 2 medium shot through the window glass: Image 1's person sits at a small candlelit dinner table across from a partner, who is seen only from behind, out of focus; they take a big bite of dinner, relaxed, unaware.",
      "Shot 3 medium close-up through the glass: mid-chew, Image 1's person notices the camera and freezes; the partner keeps eating, unaware.",
      "Shot 4 tight zoomed close-up through the glass, window frame visible: Image 1's person stares straight into the lens without blinking, for an awkwardly long beat, deadpan.",
      "Shot 5 medium shot through the glass: they slowly put the fork down, stand up, grab the curtain and yank it shut across the window in one quick motion, on screen while the partner looks up, confused.",
      "Shot 6 wide shot: the window glows behind the closed curtain in the dark building.",
    ),
  },
] as const;

const PREVIEW_PROMPT = [
  "Cinematic comedic short film, handheld night footage shot from across the street with a long zoom lens. A dark apartment block at night with one window glowing warm yellow.",
  "Every shot is filmed from outside, through that window: the dark window frame and faint reflections on the glass stay visible at the edges of every frame.",
  "The person in the lit window is the person from Image 1: keep exactly the same face, hair, skin tone, age, body and clothing.",
  "Shot 1 wide shot: the camera slowly zooms in toward the lit window.",
  "Shot 2 medium shot through the glass: Image 1's person takes a big bite of a burger at a small kitchen table.",
  "Shot 3 zoomed close-up through the glass: mid-chew, they freeze and stare straight into the lens, deadpan.",
  "Music: an original quiet, suspenseful synth tune with a low pulse. No dialogue, no text, no logos, no subtitles.",
].join(" ");

export const windowpeeper = {
  kind: "windowpeeper",
  title: "Window peeper",
  photos: 1,
  duration: 14,
  credits: 10,
  prompt: SCENES[0].prompt,
  scenes: SCENES,
  resolution: "720P",
  pro: { resolution: "1080P", credits: 20 },
  preview: { resolution: "720P", duration: 5, prompt: PREVIEW_PROMPT },
} as const satisfies PhotoEffect;
