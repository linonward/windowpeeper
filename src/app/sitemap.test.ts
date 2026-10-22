// @vitest-environment node
import { expect, test, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
// Vitest can't compile the MDX posts; the e2e tests cover them in the sitemap
// and llms.txt.
vi.mock("@/lib/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content")>()),
  listPosts: async () => [],
}));
vi.stubEnv("BETTER_AUTH_URL", "https://x.test");

const { default: sitemap } = await import("./sitemap");

test("lists each guide in every locale, with its languages", async () => {
  const entries = await sitemap();

  for (const guide of ["tip-toe-in-my-jordans", "rumpelstiltskin-meme", "how-to-make-rumpelstiltskin-video"]) {
    const languages = {
      en: `https://x.test/en/${guide}`,
      zh: `https://x.test/zh/${guide}`,
      es: `https://x.test/es/${guide}`,
      de: `https://x.test/de/${guide}`,
      "x-default": `https://x.test/en/${guide}`,
    };
    expect(entries).toContainEqual({ url: languages.en, alternates: { languages } });
    for (const locale of ["zh", "es", "de"] as const) {
      expect(entries).toContainEqual({ url: languages[locale], alternates: { languages } });
    }
  }
});
