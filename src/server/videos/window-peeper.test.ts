import { expect, test } from "vitest";
import { windowpeeper } from "./window-peeper";

// Test generations (2026-10-22) drifted into the room for the close-ups and
// showed only the closed curtain. The prompts keep the camera outside.
test.each([
  ["the full video", windowpeeper.prompt],
  ["the preview", windowpeeper.preview.prompt],
])("%s is filmed from outside, through the window", (_, prompt) => {
  expect(prompt).toContain("Every shot is filmed from outside, through that window");
  expect(prompt).toContain("window frame");
  expect(prompt).toContain("Image 1");
});

test("the full video shows the bite stay bitten and the curtain pulled on screen", () => {
  expect(windowpeeper.prompt).toContain("with a bite missing from the burger");
  expect(windowpeeper.prompt).toContain("yank it shut across the window in one quick motion, on screen");
  expect(windowpeeper.prompt).toContain("The camera never enters the room.");
});
