import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { renderWithIntl } from "@/test/intl";
import en from "../../../../messages/en.json";
import es from "../../../../messages/es.json";

// generateMetadata reads messages on the server; here they come straight
// from the files.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "es"; namespace: string }) =>
    createTranslator({ locale, messages: { en, es }[locale], namespace: namespace as never }),
}));

const pages = {
  "how-to-make-window-peeper-video": await import("./how-to-make-window-peeper-video/page"),
};
type Slug = keyof typeof pages;
const slugs = Object.keys(pages) as Slug[];

afterEach(cleanup);

const metadata = (slug: Slug, locale: "en" | "es") =>
  pages[slug].generateMetadata(
    { params: Promise.resolve({ locale }) } as never,
    Promise.resolve({ openGraph: { images: [{ url: "/og.png" }] } }) as never,
  );

// The copy a reader sees, without the h1.
function bodyText() {
  const main = screen.getByRole("main").cloneNode(true) as HTMLElement;
  main.querySelector("h1")?.remove();
  return main.textContent ?? "";
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

test.each([
  ["how-to-make-window-peeper-video", "How to make a window peeper video — One photo, six steps, one stare."],
] as const)("/%s has one h1 that names its query", (slug, name) => {
  const { default: Page } = pages[slug];
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name })).toBeDefined();
});

test.each(slugs)("/%s names its title, canonical URL, languages and preview", async (slug) => {
  const data = await metadata(slug, "es");

  expect(data.alternates).toEqual({
    canonical: `/es/${slug}`,
    languages: {
      en: `/en/${slug}`,
      es: `/es/${slug}`,
      de: `/de/${slug}`,
      "x-default": `/en/${slug}`,
    },
  });
  expect(data.openGraph).toMatchObject({
    images: [{ url: "/og.png" }],
    siteName: "WindowPeeper",
    url: `/es/${slug}`,
    title: data.title,
    description: data.description,
  });
});

// docs/landing-playbook.md: 50-60 characters with " | WindowPeeper",
// a description of 120-155.
test.each(slugs)("/%s has an English title and description of search length", async (slug) => {
  const { title, description } = await metadata(slug, "en");

  expect(`${title} | WindowPeeper`.length).toBeGreaterThanOrEqual(50);
  expect(`${title} | WindowPeeper`.length).toBeLessThanOrEqual(60);
  expect(description!.length).toBeGreaterThanOrEqual(120);
  expect(description!.length).toBeLessThanOrEqual(155);
});

test("the titles lead with each page's query", async () => {
  expect((await metadata("how-to-make-window-peeper-video", "en")).title).toBe("How to Make the Window Peeper Video");
});

test.each(slugs.flatMap((slug) => (["en", "es"] as const).map((locale) => [slug, locale] as const)))(
  "/%s in %s leads to the home generator and the other guides",
  (slug, locale) => {
    const { default: Page } = pages[slug];
    renderWithIntl(<Page />, locale);

    const main = screen.getByRole("main");
    const hrefs = within(main).getAllByRole("link").map((link) => link.getAttribute("href"));
    // The call to action at the top, and the closing one.
    expect(hrefs.filter((href) => href === `/${locale}#generator`).length).toBeGreaterThanOrEqual(2);
    for (const other of slugs.filter((each) => each !== slug)) expect(hrefs).toContain(`/${locale}/${other}`);
    expect(hrefs).not.toContain(`/${locale}/${slug}`);
    // No second generator: the page leads to the one on the home page.
    expect(screen.queryByRole("region", { name: /window peeper video|Window Peeper 视频/ })).toBeNull();
    expect(main.querySelector('input[type="file"]')).toBeNull();
  },
);

test.each(slugs)("/%s has 400-800 words of English copy in sections", (slug) => {
  const { default: Page } = pages[slug];
  renderWithIntl(<Page />);

  expect(words(bodyText())).toBeGreaterThanOrEqual(400);
  expect(words(bodyText())).toBeLessThanOrEqual(800);
  expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(4);
});

test.each(slugs)("/%s says it isn't affiliated with TikTok, CapCut or the trend's creators", (slug) => {
  const { default: Page } = pages[slug];
  renderWithIntl(<Page />);

  expect(bodyText()).toContain(
    "isn't affiliated with, endorsed by or sponsored by TikTok, CapCut or the creators of any template or clip",
  );
});

test("the how-to states the prices and photo size from the config", () => {
  const { default: Page } = pages["how-to-make-window-peeper-video"];
  renderWithIntl(<Page />);

  const text = bodyText();
  expect(text).toContain("Standard costs 10 credits and is 720p. Pro costs 20 credits and is 1080p");
  expect(text).toContain("10 credits for $9.90, 50 credits for $29.90, and 250 credits for $99.90");
  expect(text).toContain("up to 10 MB, from 240 to 8,000 pixels on each side");
  expect(text).toContain("its credits go back to your balance automatically");
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Pick a photo",
    "Confirm it's OK to use",
    "Choose Standard or Pro",
    "Sign in",
    "Pay if you need credits",
    "Wait, then download and post",
  ]);
});

test("renders in Spanish, with the same sections", () => {
  for (const slug of slugs) {
    const { default: Page } = pages[slug];
    renderWithIntl(<Page />);
    const english = screen.getAllByRole("heading", { level: 2 }).length;
    cleanup();
    renderWithIntl(<Page />, "es");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(english);
    expect(screen.getByRole("main").textContent).toMatch(/[áéíóúñ¿¡]/);
    cleanup();
  }
});
