import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { renderWithIntl } from "@/test/intl";
import en from "../../../../messages/en.json";
import zh from "../../../../messages/zh.json";

// generateMetadata reads messages on the server; here they come straight
// from the files.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "zh"; namespace: string }) =>
    createTranslator({ locale, messages: { en, zh }[locale], namespace: namespace as never }),
}));

const pages = {
  "tip-toe-in-my-jordans": await import("./tip-toe-in-my-jordans/page"),
  "rumpelstiltskin-meme": await import("./rumpelstiltskin-meme/page"),
  "how-to-make-rumpelstiltskin-video": await import("./how-to-make-rumpelstiltskin-video/page"),
  "who-is-rumpelstiltskin": await import("./who-is-rumpelstiltskin/page"),
  "rumpelstiltskin-movie": await import("./rumpelstiltskin-movie/page"),
  "rumpelstiltskin-1987-movie": await import("./rumpelstiltskin-1987-movie/page"),
  "rumpelstiltskin-dance-scene": await import("./rumpelstiltskin-dance-scene/page"),
};
type Slug = keyof typeof pages;
const slugs = Object.keys(pages) as Slug[];

afterEach(cleanup);

const metadata = (slug: Slug, locale: "en" | "zh") =>
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
  ["tip-toe-in-my-jordans", "Tip Toe in My Jordans — The tip-toe dance meme, made from your photo."],
  ["rumpelstiltskin-meme", "Rumpelstiltskin meme — What the tip-toe dance is, and why it spread."],
  ["how-to-make-rumpelstiltskin-video", "How to make a Rumpelstiltskin video — One photo, six steps, a dancing video."],
  ["who-is-rumpelstiltskin", "Who is Rumpelstiltskin? — The fairy-tale imp behind the tip-toe dance."],
  ["rumpelstiltskin-movie", "Rumpelstiltskin movie — The films and TV versions, in order."],
  ["rumpelstiltskin-1987-movie", "Rumpelstiltskin 1987 movie — The real film, and the AI clip people mistake for it."],
  ["rumpelstiltskin-dance-scene", "Rumpelstiltskin dance scene — The viral clip, beat by beat, and how a video made here compares."],
] as const)("/%s has one h1 that names its query", (slug, name) => {
  const { default: Page } = pages[slug];
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name })).toBeDefined();
});

test.each(slugs)("/%s names its title, canonical URL, languages and preview", async (slug) => {
  const data = await metadata(slug, "zh");

  expect(data.alternates).toEqual({
    canonical: `/zh/${slug}`,
    languages: {
      en: `/en/${slug}`,
      zh: `/zh/${slug}`,
      es: `/es/${slug}`,
      de: `/de/${slug}`,
      "x-default": `/en/${slug}`,
    },
  });
  expect(data.openGraph).toMatchObject({
    images: [{ url: "/og.png" }],
    siteName: "AIRumpelstiltskinVideo",
    url: `/zh/${slug}`,
    title: data.title,
    description: data.description,
  });
});

// docs/landing-playbook.md: 50-60 characters with " | AIRumpelstiltskinVideo",
// a description of 120-155.
test.each(slugs)("/%s has an English title and description of search length", async (slug) => {
  const { title, description } = await metadata(slug, "en");

  expect(`${title} | AIRumpelstiltskinVideo`.length).toBeGreaterThanOrEqual(50);
  expect(`${title} | AIRumpelstiltskinVideo`.length).toBeLessThanOrEqual(60);
  expect(description!.length).toBeGreaterThanOrEqual(120);
  expect(description!.length).toBeLessThanOrEqual(155);
});

test("the titles lead with each page's query", async () => {
  expect((await metadata("tip-toe-in-my-jordans", "en")).title).toBe("Tip Toe in My Jordans Meme");
  expect((await metadata("rumpelstiltskin-meme", "en")).title).toBe("Rumpelstiltskin Meme Explained");
  expect((await metadata("how-to-make-rumpelstiltskin-video", "en")).title).toBe("How to Make a Rumpelstiltskin Video");
  expect((await metadata("who-is-rumpelstiltskin", "en")).title).toBe("Who Is Rumpelstiltskin? The Story");
  expect((await metadata("rumpelstiltskin-movie", "en")).title).toBe("Rumpelstiltskin Movie: All Versions");
  expect((await metadata("rumpelstiltskin-1987-movie", "en")).title).toBe("Rumpelstiltskin 1987 Movie vs AI");
  expect((await metadata("rumpelstiltskin-dance-scene", "en")).title).toBe("The Rumpelstiltskin Dance Scene");
});

test("the tale page tells both endings and what the name means", () => {
  const { default: Page } = pages["who-is-rumpelstiltskin"];
  renderWithIntl(<Page />);

  const ending = screen.getByRole("region", { name: "How the story ends" });
  expect(ending.textContent).toContain("1812");
  expect(ending.textContent).toContain("1857");
  expect(screen.getByRole("region", { name: "What the name means" }).textContent).toContain("little rattle stilt");
});

test("the movie page lists the screen versions in order", () => {
  const { default: Page } = pages["rumpelstiltskin-movie"];
  renderWithIntl(<Page />);

  const versions = screen.getByRole("region", { name: "Every version, in order" });
  const years = within(versions)
    .getAllByRole("listitem")
    .map((item) => Number(item.textContent?.match(/\d{4}/)?.[0]));
  expect(years).toEqual([...years].sort((a, b) => a - b));
  expect(years).toEqual(expect.arrayContaining([1940, 1955, 1982, 1987, 1995, 2009, 2010]));
});

test("the 1987 page answers first: the viral clip isn't from the film", () => {
  const { default: Page } = pages["rumpelstiltskin-1987-movie"];
  renderWithIntl(<Page />);

  const answer = screen.getAllByRole("heading", { level: 2 })[0].closest("section") as HTMLElement;
  expect(answer.textContent).toMatch(/^The short answer\s*No\./);
  expect(screen.getByRole("region", { name: "The real 1987 film" }).textContent).toContain("Billy Barty");
  // The source it cites, as a link that leaves the site.
  const kym = within(answer).getByRole("link", { name: "Know Your Meme" });
  expect(kym.getAttribute("href")).toBe("https://knowyourmeme.com/memes/ai-rumpelstiltskin-tip-toein-in-my-jordans");
  expect(kym.getAttribute("rel")).toBe("noopener noreferrer");
  expect(kym.getAttribute("target")).toBe("_blank");
});

test("the 1987 page says where to watch the film legally, with a source that lists current services", () => {
  const { default: Page } = pages["rumpelstiltskin-1987-movie"];
  renderWithIntl(<Page />);

  const watch = screen.getByRole("region", { name: "Where to watch it legally" });
  expect(watch.textContent).toContain("as of October 2026");
  expect(watch.textContent).toContain("Tubi");
  const justwatch = within(watch).getByRole("link", { name: "JustWatch" });
  expect(justwatch.getAttribute("href")).toBe("https://www.justwatch.com/us/movie/rumpelstiltskin");
  expect(justwatch.getAttribute("rel")).toBe("noopener noreferrer");
});

test("the dance scene page says the scene is AI, tells it in order and compares it with a video made here", () => {
  const { default: Page } = pages["rumpelstiltskin-dance-scene"];
  renderWithIntl(<Page />);

  const origin = screen.getAllByRole("heading", { level: 2 })[0].closest("section") as HTMLElement;
  expect(origin.textContent).toMatch(/^Where the scene comes from\s*The scene isn't from a film\./);
  const beats = within(screen.getByRole("region", { name: "The scene, beat by beat" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(beats[0]).toContain("barn");
  expect(beats.at(-1)).toContain("prince");
  // The comparison states what the tip-toe effect makes (src/server/videos/tiptoe.ts).
  const compare = screen.getByRole("region", { name: "The viral clip and a video made here" }).textContent;
  expect(compare).toContain("the person in your photo");
  expect(compare).toContain("no gold and no kiss");
  expect(compare).toContain("12 seconds");
  expect(compare).toContain("original");
});

test.each(slugs.flatMap((slug) => (["en", "zh"] as const).map((locale) => [slug, locale] as const)))(
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
    expect(screen.queryByRole("region", { name: /tip-toe video|踮脚舞视频/ })).toBeNull();
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

// The meme borrowed a nickname from a song; the pages name no brand, artist
// or song. Only the one page's title and h1 use the nickname.
test.each(slugs.flatMap((slug) => (["en", "zh"] as const).map((locale) => [slug, locale] as const)))(
  "/%s in %s names no brand, artist or song in its body",
  (slug, locale) => {
    const { default: Page } = pages[slug];
    renderWithIntl(<Page />, locale);

    expect(bodyText()).not.toMatch(/nike|jordan|riff\s*raff|乔丹|耐克/i);
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/nike|air jordan|riff\s*raff/i);
  },
);

test.each(slugs)("/%s says it isn't affiliated with the meme's brands, artists or creators", (slug) => {
  const { default: Page } = pages[slug];
  renderWithIntl(<Page />);

  expect(bodyText()).toContain(
    "isn't affiliated with, endorsed by or sponsored by any brand, artist or the creators of the original video",
  );
});

test("the how-to states the prices and photo size from the config", () => {
  const { default: Page } = pages["how-to-make-rumpelstiltskin-video"];
  renderWithIntl(<Page />);

  const text = bodyText();
  expect(text).toContain("Standard costs 10 credits and is 720p. Pro costs 20 credits and is 1080p");
  expect(text).toContain("10 credits for $4.99, 20 credits for $7.99, and 30 credits for $11.99");
  expect(text).toContain("up to 5 MB, from 240 to 8,000 pixels on each side");
  expect(text).toContain("its credits go back to your balance automatically");
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Pick a photo",
    "Confirm it's OK to use",
    "Choose Standard or Pro",
    "Sign in",
    "Pay if you need credits",
    "Wait, then download or share",
  ]);
});

test("the meme page says plainly that videos made here are AI, with original music", () => {
  const { default: Page } = pages["rumpelstiltskin-meme"];
  renderWithIntl(<Page />);

  const section = screen.getByRole("region", { name: "Is it real or AI?" });
  expect(section.textContent).toContain("Videos made on this site are AI-generated.");
  expect(section.textContent).toContain("makes a new scene that stars the person in it, with original music");
});

test("the meme page dates where the meme started, in order, and cites the report that it is AI", () => {
  const { default: Page } = pages["rumpelstiltskin-meme"];
  renderWithIntl(<Page />);

  const origin = screen.getByRole("region", { name: "Where the meme started" });
  const items = within(origin).getAllByRole("listitem").map((item) => item.textContent ?? "");
  expect(items[0]).toMatch(/^27 August 2026: an AI artist posts the clip on Instagram/);
  const months = { August: 8, September: 9, October: 10 } as Record<string, number>;
  const dates = items.map((item) => {
    const [, day, month] = item.match(/^(?:Early )?(\d+)? ?(August|September|October)/) ?? [];
    return months[month] * 100 + Number(day ?? 1);
  });
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
  const nbc = within(origin).getByRole("link", { name: "NBC News" });
  expect(nbc.getAttribute("href")).toBe(
    "https://www.nbcnews.com/tech/internet/ai-generated-rumpelstiltskin-meme-freaking-much-internet-rcna602132",
  );
  expect(within(origin).getByRole("link", { name: "dance scene guide" }).getAttribute("href")).toBe(
    "/en/rumpelstiltskin-dance-scene",
  );
});

test("renders in Chinese, with the same sections", () => {
  for (const slug of slugs) {
    const { default: Page } = pages[slug];
    renderWithIntl(<Page />);
    const english = screen.getAllByRole("heading", { level: 2 }).length;
    cleanup();
    renderWithIntl(<Page />, "zh");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(english);
    expect(screen.getByRole("main").textContent).toMatch(/[一-鿿]/);
    cleanup();
  }
});
