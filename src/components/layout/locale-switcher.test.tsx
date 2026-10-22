import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { LocaleLinks, LocaleSwitcher } from "./locale-switcher";

// A third locale shows the list doesn't assume two languages.
vi.mock("@/i18n/routing", async (importOriginal) => {
  const { defineRouting } = await import("next-intl/routing");
  return {
    ...(await importOriginal<typeof import("@/i18n/routing")>()),
    routing: defineRouting({
      locales: ["en", "es", "ja"],
      defaultLocale: "en",
      localePrefix: "as-needed",
      localeDetection: false,
    }),
    LOCALE_NAMES: { en: "English", es: "Español", ja: "日本語" },
  };
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/sign-in",
}));

afterEach(cleanup);

test("lists every language, keeps the page and marks the current one", () => {
  renderWithIntl(<LocaleLinks />);

  const links = screen.getAllByRole("link");
  expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    // English has no prefix.
    ["English", "/sign-in"],
    ["Español", "/es/sign-in"],
    ["日本語", "/ja/sign-in"],
  ]);
  expect(links[0].getAttribute("aria-current")).toBe("true");
  expect(links[1].getAttribute("lang")).toBe("es");
});

test("the header's menu shows the current language's code and links every language", async () => {
  renderWithIntl(<LocaleSwitcher />, "es");

  const trigger = screen.getByRole("button", { name: "Idioma: Español" });
  expect(trigger.textContent).toBe("ES");

  fireEvent.click(trigger);

  const items = await screen.findAllByRole("menuitem");
  expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual([
    ["English", "/sign-in"],
    ["Español", "/es/sign-in"],
    ["日本語", "/ja/sign-in"],
  ]);
  expect(items[1].getAttribute("aria-current")).toBe("true");
});
