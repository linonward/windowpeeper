// @vitest-environment node
import { expect, test, vi } from "vitest";
import { createFormatter, createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import de from "../../../messages/de.json";

vi.mock("next/server", () => ({ connection: async () => {} }));
// The route reads messages on the server; here they come straight from the files.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "es" | "de"; namespace: string }) =>
    createTranslator({ locale, messages: { en, es, de }[locale], namespace: namespace as never }),
  getFormatter: async ({ locale }: { locale: "en" | "es" | "de" }) => createFormatter({ locale }),
}));
// Vitest can't compile the MDX posts; the e2e tests cover them in the sitemap
// and llms.txt.
vi.mock("@/lib/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content")>()),
  listPosts: async () => [],
}));
vi.stubEnv("BETTER_AUTH_URL", "https://x.test");

const { GET } = await import("./route");

test("links each guide in every locale, with its title and description", async () => {
  const text = await (await GET()).text();

  expect(text).toContain(
    "- [How to Make the Window Peeper Video](https://x.test/how-to-make-window-peeper-video): Turn one photo into a window peeper trend video",
  );
  expect(text).toContain("- [Cómo hacer un video de window peeper](https://x.test/es/how-to-make-window-peeper-video): ");
  // No ICU or markup left over.
  expect(text).not.toMatch(/[{}]|<\/?\w/);
});

// Language models read llms.txt as an index: each guide with what it covers,
// and the full text one link away.
test("is an index of the guides and points to the full text", async () => {
  const text = await (await GET()).text();

  expect(text).toMatch(/^# WindowPeeper\n\n> /);
  expect(text).toContain("- [Window Peeper Trend Meaning, Explained](https://x.test/window-peeper-trend): ");
  expect(text).toContain("- [Window Peeper CapCut Template vs AI](https://x.test/window-peeper-capcut-template): ");
  expect(text).toContain("- [Full text of every guide](https://x.test/llms-full.txt)");
  expect(text).toContain("A photo of yourself only");
  expect(text).not.toContain("agreed to");
});
