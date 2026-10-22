// @vitest-environment node
import { expect, test, vi } from "vitest";
import { createFormatter, createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import zh from "../../../messages/zh.json";
import es from "../../../messages/es.json";
import de from "../../../messages/de.json";

vi.mock("next/server", () => ({ connection: async () => {} }));
// The route reads messages on the server; here they come straight from the files.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "zh" | "es" | "de"; namespace: string }) =>
    createTranslator({ locale, messages: { en, zh, es, de }[locale], namespace: namespace as never }),
  getFormatter: async ({ locale }: { locale: "en" | "zh" | "es" | "de" }) => createFormatter({ locale }),
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
    "- [How to Make the Window Peeper Video](https://x.test/en/how-to-make-window-peeper-video): Turn one photo into a window peeper trend video",
  );
  expect(text).toContain("- [如何制作 Window Peeper 视频](https://x.test/zh/how-to-make-window-peeper-video): ");
  // No ICU or markup left over.
  expect(text).not.toMatch(/[{}]|<\/?\w/);
});
