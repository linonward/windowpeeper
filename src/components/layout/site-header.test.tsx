import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { AccountLink, SiteHeader } from "./site-header";
import { localePath } from "@/i18n/routing";

// The locale switcher reads the current path, which jsdom doesn't provide.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

afterEach(cleanup);

test("signed-out visitors get a sign-in button", () => {
  renderWithIntl(<SiteHeader account={<AccountLink signedIn={false} />} />);

  const banner = screen.getByRole("banner");
  expect(within(banner).getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
    "/sign-in",
  );
  expect(within(banner).queryByRole("link", { name: "Dashboard" })).toBeNull();
});

test("signed-in users get a button to their videos", () => {
  renderWithIntl(<SiteHeader account={<AccountLink signedIn />} />);

  const banner = screen.getByRole("banner");
  expect(within(banner).getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe(
    "/videos",
  );
  expect(within(banner).queryByRole("link", { name: "Sign in" })).toBeNull();
});

test("both buttons are translated", () => {
  renderWithIntl(
    <>
      <AccountLink signedIn={false} />
      <AccountLink signedIn />
    </>,
    "es",
  );

  expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/es/sign-in");
  expect(screen.getByRole("link", { name: "Panel" }).getAttribute("href")).toBe("/es/videos");
});

test.each([
  ["en", ["Scenes", "How it works", "Pricing", "Blog"]],
] as const)("the nav leads to two home page sections, pricing and the blog in %s", (locale, names) => {
  renderWithIntl(<SiteHeader account={null} />, locale);

  const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    [names[0], `${localePath(locale)}#scenes`],
    [names[1], `${localePath(locale)}#how-it-works`],
    [names[2], localePath(locale, "/pricing")],
    [names[3], localePath(locale, "/blog")],
  ]);
});

test("the header's button leads to the generator", () => {
  renderWithIntl(<SiteHeader account={null} />);

  expect(screen.getByRole("link", { name: "Make a video" }).getAttribute("href")).toBe("/#generator");
});
