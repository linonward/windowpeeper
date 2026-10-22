import { expect, test } from "vitest";
import { SCENES, windowpeeper } from "./window-peeper";

// Test generations (2026-10-22) drifted into the room for the close-ups and
// showed only the closed curtain. The prompts keep the camera outside.
test.each([
  ...SCENES.map(({ id, prompt }) => [`the ${id} scene`, prompt] as const),
  ["the preview", windowpeeper.preview.prompt] as const,
])("%s is filmed from outside, through the window", (_, prompt) => {
  expect(prompt).toContain("Every shot is filmed from outside, through that window");
  expect(prompt).toContain("window frame");
  expect(prompt).toContain("Image 1");
});

test("the full video is the burger scene: the bite stays bitten and the curtain is pulled on screen", () => {
  expect(windowpeeper.prompt).toBe(SCENES[0].prompt);
  expect(windowpeeper.prompt).toContain("with a bite missing from the burger");
  expect(windowpeeper.prompt).toContain("yank it shut across the window in one quick motion, on screen");
  expect(windowpeeper.prompt).toContain("The camera never enters the room.");
});

// The wave scene ends on the wave, not the curtain.
test.each(SCENES.filter(({ id }) => id !== "wave"))("the $id scene pulls the curtain on screen", ({ prompt }) => {
  expect(prompt).toContain("yank it shut across the window in one quick motion, on screen");
});
