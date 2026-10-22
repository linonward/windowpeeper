// @vitest-environment node
import { expect, test, vi } from "vitest";
import { createFormatter, createTranslator } from "next-intl";
import en from "../../../messages/en.json";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) =>
    createTranslator({ locale: "en", messages: en, namespace: namespace as never }),
  getFormatter: async () => createFormatter({ locale: "en" }),
}));
vi.stubEnv("BETTER_AUTH_URL", "https://x.test");

const { GET } = await import("./route");

// Every guide's full text in one Markdown file, in English, so a language
// model can read the site without rendering it.
test("holds every guide's full text as Markdown", async () => {
  const response = await GET();
  const text = await response.text();

  expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
  expect(text).toContain("# How to make a window peeper video\n\nSource: https://x.test/how-to-make-window-peeper-video");
  expect(text).toContain("## Step by step");
  expect(text).toContain("1. **Pick a photo.** Open the generator on the home page and choose a photo of yourself");
  expect(text).toContain("# What is the window peeper trend?");
  expect(text).toContain("# Window peeper CapCut template");
  expect(text).toContain("## Window peeper AI video questions");
  // Prices and limits filled in; no ICU or markup left over.
  expect(text).toContain("up to 10 MB");
  expect(text).not.toMatch(/[{}]|<\/?\w/);
});
