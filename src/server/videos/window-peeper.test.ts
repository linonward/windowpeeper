import { expect, test } from "vitest";
import { SCENES, windowpeeper } from "./window-peeper";

const ALL = [
  ...SCENES.map(({ id, prompt }) => [`the ${id} scene`, prompt] as const),
  ["the preview", windowpeeper.preview.prompt] as const,
];

// Test generations (2026-10-22) drifted into the room for the close-ups and
// showed only the closed curtain. The prompts keep the camera outside.
test.each(ALL)("%s is filmed from outside, through the window", (_, prompt) => {
  expect(prompt).toContain("The camera stays outside the whole time and films through that window");
  expect(prompt).toContain("window frame");
  expect(prompt).toContain("The camera never enters the room.");
  expect(prompt).toContain("Image 1");
});

// The trend is one shaky phone take: a zoom onto the window, then one
// medium shot held to the end. Cuts, close-ups and a cinematic look made it
// read as a film; the zoom skipped the building or pushed past the window
// frame (2026-10-23).
test.each(ALL)("%s is one continuous handheld phone shot", (_, prompt) => {
  expect(prompt).toContain("shot to look like vertical handheld smartphone footage");
  expect(prompt).toContain("One continuous shot with no cuts");
  expect(prompt).toContain("opens on a wide shot of the whole dark apartment block");
  expect(prompt).toContain("the window frame and windowsill visible on every side. The zoom never pushes closer.");
  expect(prompt).not.toMatch(/Shot \d|[Cc]inematic|film grain/);
});

test("the full video is the burger scene: the bite stays bitten and the curtain is pulled on screen", () => {
  expect(windowpeeper.prompt).toBe(SCENES[0].prompt);
  expect(windowpeeper.prompt).toContain("a bite already missing from it");
  expect(windowpeeper.prompt).toContain("yank it shut across the window in one quick motion, on screen");
});

// The wave scene ends on the wave, not the curtain. The video ends as the
// curtain closes, with no shot after it.
test.each(SCENES.filter(({ id }) => id !== "wave"))("the $id scene ends on the curtain, pulled on screen", ({ prompt }) => {
  expect(prompt).toContain("yank it shut across the window in one quick motion, on screen");
  expect(prompt).toContain("The video ends as the curtain closes");
});

// The subject glares the whole time, the face spelled out: "a disgusted
// look" came out blank (2026-10-23).
test.each(ALL)("%s keeps a disgusted scowl", (_, prompt) => {
  expect(prompt).toContain("glare straight into the lens with a disgusted, grumpy scowl: brow furrowed, nose wrinkled, upper lip curled");
});

// The trend's sound is live audio, not music: a quiet night street, then the
// woman filming bursts out laughing off screen while the subject glares.
test.each(ALL)("%s has the filmer's laughter and no music", (_, prompt) => {
  expect(prompt).toContain("the unseen woman filming bursts out laughing");
  expect(prompt).toContain("a woman's helpless, mocking ha-ha-ha laughter");
  expect(prompt).toContain("No music, no spoken words");
  expect(prompt).not.toContain("synth");
  expect(prompt).not.toContain("No dialogue");
});

// The subject reacts to the laughter: it starts during the glare, and they
// hear it before they pull the curtain (or wave).
test.each(SCENES)("in the $id scene the laughter starts in the glare and the subject hears it", ({ prompt }) => {
  const glare = prompt.indexOf("glare straight into the lens");
  const laugh = prompt.indexOf("the unseen woman filming bursts out laughing");
  const reaction = prompt.indexOf("hearing the laughter, ");
  expect(glare).toBeGreaterThan(-1);
  expect(laugh).toBeGreaterThan(glare);
  expect(reaction).toBeGreaterThan(laugh);
});

// Bailian's moderation rejected a finished video (DataInspectionFailed,
// 2026-10-23) when the prompt read like real covert footage: a "prank"
// filmed "from across the street". The prompt says it's a staged sketch with
// an actor who knows the camera is there.
test.each(ALL)("%s reads as a staged sketch, not covert footage", (_, prompt) => {
  expect(prompt).toContain("Comedic staged sketch, performed by an actor who knows they are being filmed");
  expect(prompt).not.toMatch(/prank|across the street|spy|peep|hidden|secret/i);
});
