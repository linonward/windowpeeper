import type { PhotoEffect } from "./photo-effects";

// The window peeper trend, a staged comedy bit filmed as one shaky phone
// take: the camera zooms onto the one lit window in a dark apartment block at
// night, where the photo's subject eats a burger and glares into the lens,
// scowling; the woman filming bursts out laughing off screen, and the subject
// hears it, stands up and pulls the curtain shut. Five more scenes change the
// food, the weather, the company or the ending. Bailian wan2.7-r2v makes it
// from the photo and the scene's prompt, with live sound and no music. Never
// name the trend's creators or its sound. The subject keeps the outfit from
// the photo, so the prompt doesn't dress them.
// It sells two qualities at 14 seconds: standard (720P) and Pro (1080P).
// margins.test.ts checks both prices against REFERENCE_COST_PER_SECOND. Each
// account also gets one free 5-second preview: the zoom, the bite and the
// glare, at 720P, with Bailian's watermark. In test generations the camera
// drifted into the room, and cuts and close-ups made it read as a film, so
// the prompts hold one shot, outside, through the glass. Bailian's moderation
// rejected a video whose prompt read like covert footage, so the prompts
// call it a staged sketch. window-peeper.test.ts checks all three.

// What every scene shares: the phone footage, the lit window seen from
// outside, the subject, the glare, the laughter and the sound. Each scene
// adds what's on the table and how it ends.
const OPENING = [
  "Comedic staged sketch, performed by an actor who knows they are being filmed, shot to look like vertical handheld smartphone footage at night, with slight camera shake. One continuous shot with no cuts.",
  "A dark apartment block at night; every window is dark except one, glowing warm yellow.",
  "The camera stays outside the whole time and films through that window: the dark window frame and the windowsill stay visible at the edges of the frame. The camera never enters the room.",
  "The person in the lit window is the person from Image 1: keep exactly the same face, hair, skin tone, age, body and clothing.",
];
// The zoom starts on the whole building and stops at the window: test
// generations skipped the building or pushed into a close-up.
const zoom = (seconds: string) =>
  `${seconds}: the video opens on a wide shot of the whole dark apartment block, every floor in view, the lit window small in the middle. The camera zooms in, a little shaky, onto the lit window and stops there. From then on it holds that medium shot of the window to the end: the person's upper body fills about a third of the frame, with the window frame and windowsill visible on every side. The zoom never pushes closer.`;
// "A disgusted look" came out blank, so this spells out the face.
const SCOWL = "a disgusted, grumpy scowl: brow furrowed, nose wrinkled, upper lip curled";
// The subject has already seen the camera and glares while eating.
const glare = (eating: string, who = "They have") =>
  `3-9s: ${eating} ${who} already spotted the camera: still chewing slowly, they glare straight into the lens with ${SCOWL}, for an awkwardly long time.`;
const LAUGH =
  "9-11s: the unseen woman filming bursts out laughing behind the camera: a woman's helpless, mocking ha-ha-ha laughter, off screen. They keep glaring.";
// The subject hears the laughter and shuts the curtain; the video ends there.
const curtain = (action: string, after = "") =>
  `11-14s: hearing the laughter, still scowling in disgust, they ${action}, grab the curtain and yank it shut across the window in one quick motion, on screen.${after} The video ends as the curtain closes, with no shot after it.`;
const SOUND =
  "Sound: live phone audio: the quiet hum of a night street, then the off-screen laughter of the woman filming. No music, no spoken words, no text, no logos, no subtitles.";
const scene = (...beats: string[]) => [...OPENING, zoom("0-3s"), ...beats, SOUND].join(" ");

// The six windows the buyer picks from, the original first. Each id is
// stored on the video (video.scene) and named in PhotoEffects.scenes in
// messages/*.json; src/test/photo-effects.test.ts checks both.
export const SCENES = [
  {
    id: "burger",
    prompt: scene(
      glare(
        "Image 1's person sits alone at a small table with a takeaway paper bag and a red fries box, eating a burger with both hands, a bite already missing from it.",
      ),
      LAUGH,
      curtain("put the burger down, stand up"),
    ),
  },
  {
    id: "noodles",
    prompt: scene(
      glare(
        "Image 1's person sits alone at a small kitchen table with a steaming bowl of noodles, slurping a mouthful with chopsticks, noodles hanging from their mouth.",
      ),
      LAUGH,
      curtain("put the chopsticks down, stand up"),
    ),
  },
  {
    id: "pizza",
    prompt: scene(
      glare(
        "Image 1's person sits alone on a couch with an open pizza box, eating a slice of pizza, the cheese stretching.",
      ),
      LAUGH,
      curtain("put the slice down, stand up"),
    ),
  },
  {
    id: "wave",
    prompt: scene(
      glare(
        "Image 1's person sits alone at a small table with a takeaway paper bag and a red fries box, eating a burger with both hands.",
      ),
      LAUGH,
      "11-14s: hearing the laughter, still chewing and still scowling, they slowly raise one hand and give the lens a small polite wave. The video ends on the wave.",
    ),
  },
  {
    id: "glass",
    prompt: scene(
      "Rain runs down the window glass the whole time, droplets catching the warm light.",
      glare(
        "Image 1's person sits alone at a small table eating a burger, blurred a little by the rain on the glass, and leans toward the window.",
      ),
      LAUGH,
      curtain("stand up"),
    ),
  },
  {
    id: "couple",
    prompt: scene(
      glare(
        "Image 1's person sits at a small candlelit dinner table across from a partner, who is seen only from behind, out of focus, and keeps eating, unaware; Image 1's person eats dinner with a fork.",
        "Image 1's person has",
      ),
      LAUGH,
      curtain("put the fork down, stand up", " The partner looks up, confused."),
    ),
  },
] as const;

const PREVIEW_PROMPT = [
  ...OPENING,
  zoom("0-1s"),
  "1-5s: Image 1's person sits alone at a small table with a takeaway paper bag and a red fries box, eating a burger with both hands. They have already spotted the camera: still chewing slowly, they glare straight into the lens with " +
    SCOWL +
    ". At the end, the unseen woman filming bursts out laughing behind the camera: a woman's helpless, mocking ha-ha-ha laughter, off screen.",
  SOUND,
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
