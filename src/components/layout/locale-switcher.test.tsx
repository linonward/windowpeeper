import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { LocaleLinks } from "./locale-switcher";

// A third locale shows the list doesn't assume two languages.
vi.mock("@/i18n/routing", async () => {
  const { defineRouting } = await import("next-intl/routing");
  return {
    routing: defineRouting({ locales: ["en", "zh", "ja"], defaultLocale: "en" }),
    LOCALE_NAMES: { en: "English", zh: "中文", ja: "日本語" },
  };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/en/sign-in",
}));

afterEach(cleanup);

test("lists every language, keeps the page and marks the current one", () => {
  renderWithIntl(<LocaleLinks />);

  const links = screen.getAllByRole("link");
  expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["English", "/en/sign-in"],
    ["中文", "/zh/sign-in"],
    ["日本語", "/ja/sign-in"],
  ]);
  expect(links[0].getAttribute("aria-current")).toBe("true");
  expect(links[1].getAttribute("lang")).toBe("zh");
});
