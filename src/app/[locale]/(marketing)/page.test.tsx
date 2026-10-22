import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signIn: { social: vi.fn(), magicLink: vi.fn() },
  },
}));

const { default: Page } = await import("./page");

afterEach(cleanup);

// The large headline is the h1: the query the home page targets, then the
// tagline. The small badge above it isn't a heading.
test("the only h1 is the large headline: the query, then the tagline", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Window peeper AI video — Get caught in the window with one photo.",
    }),
  ).toBeDefined();
});

test("the badge above the h1 names the brand and the trend", () => {
  renderWithIntl(<Page />);

  const badge = screen.getByText("The TikTok window peeper trend").parentElement;
  expect(badge?.tagName).toBe("P");
  expect(badge?.textContent).toBe("WindowPeeper The TikTok window peeper trend");
});

test("the generator sits in the hero, with the video's price on its button", () => {
  renderWithIntl(<Page />);

  const generator = screen.getByRole("region", { name: "Make your window peeper video" });
  expect(screen.getByRole("heading", { level: 1 }).closest("section")?.contains(generator)).toBe(true);
  expect(within(generator).getByLabelText("Your photo")).toBeDefined();
  expect(within(generator).getByRole("button", { name: /^Generate \(\d+ credits\)$/ })).toBeDefined();
});

// No example clip yet: the hero shows no video, and the generator follows
// the headline at once, with no buttons in between.
test("the hero has no clip yet, and no buttons before the generator", () => {
  renderWithIntl(<Page />);

  const hero = screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
  expect(hero.querySelector("video")).toBeNull();
  expect(within(hero).queryByRole("region", { name: "What your video looks like" })).toBeNull();
  const generator = screen.getByRole("region", { name: "Make your window peeper video" });
  // Links in the hero belong to the generator (sign-in, terms), never above it.
  expect(within(hero).queryAllByRole("link").filter((link) => !generator.contains(link))).toEqual([]);
});

test("the sections follow the generator: steps, the explainer, pricing, FAQ, then the closing call to action", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Make your window peeper video",
    "Three steps to your window peeper video",
    "About the window peeper AI video",
    "Start with one video.",
    "Window peeper video questions",
    "Your turn in the window.",
  ]);
});

test("a strip under the hero names what a video is", () => {
  renderWithIntl(<Page />);

  const strip = screen.getByRole("list", { name: "What you get" });
  expect(within(strip).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "One photo",
    "12 seconds",
    "Original music",
  ]);
});

// The same packs as the pricing page, each leading to billing.
test("pricing lists the credit packs from the config by the videos they buy, the first recommended", () => {
  renderWithIntl(<Page />);

  const pricing = screen.getByRole("region", { name: "Start with one video." });
  expect(pricing.id).toBe("pricing");
  // The cards, without the perks listed inside each.
  const packs = Array.from(pricing.querySelector("ul")!.children) as HTMLElement[];
  expect(packs.map((pack) => within(pack).getByRole("heading", { level: 3 }).textContent)).toEqual([
    "1 video",
    "1 Pro video",
    "3 videos",
  ]);
  expect(packs[0].textContent).toContain("$4.99");
  expect(packs[0].textContent).toContain("Recommended");
  expect(within(packs[0]).getByRole("link").getAttribute("href")).toBe("/en/billing?pack=small");
  expect(within(packs[0]).getByRole("link").getAttribute("rel")).toBe("nofollow");
  expect(within(pricing).getByRole("link", { name: "See full pricing" }).getAttribute("href")).toBe("/en/pricing");
});

test("the steps go from a photo to a shared video", () => {
  renderWithIntl(<Page />);

  const steps = screen.getByRole("region", { name: "Three steps to your window peeper video" });
  expect(within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Upload your photo",
    "We film the scene",
    "Download & post",
  ]);
});

test("FAQ questions are numbered and state the price from the config", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "Window peeper video questions" });
  expect(within(faq).getByText("01")).toBeDefined();
  expect(within(faq).getByText("12")).toBeDefined();
  expect(within(faq).getByText("What is the window peeper trend?")).toBeDefined();
  const cost = within(faq).getByText("How much does it cost?").closest("details") as HTMLElement;
  // CREDIT_PACKS and the window peeper video's prices, in dollars too.
  expect(cost.textContent).toContain(
    "A window peeper video costs 10 credits. A Pro video, in sharper 1080p, costs 20 credits. " +
      "Credits come in one-time packs: 10 credits for $4.99, 20 credits for $7.99, and 30 credits for $11.99. " +
      "There is no subscription, and credits never expire. If a video fails, the credits are refunded.",
  );
  expect(within(cost).getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

// The long answer under the steps: one topic per h3, each sending readers to
// the guide that covers it in full.
test("the explainer answers the searches around the generator and links the guides", () => {
  renderWithIntl(<Page />);

  const about = screen.getByRole("region", { name: "About the window peeper AI video" });
  expect(within(about).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "What the generator makes",
    "A new video, not a CapCut template",
    "What the window peeper trend is",
    "Filter, effect or AI video?",
    "Music and the trend's sound",
    "Posting to TikTok, Reels and Shorts",
    "Standard or Pro",
  ]);
  const links = within(about)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
  expect(links).toEqual(expect.arrayContaining(["/en/how-to-make-window-peeper-video", "/en/pricing", "#generator"]));
  expect(about.textContent?.split(/\s+/).length).toBeGreaterThan(500);
});

test("FAQ answers whether the video works on short-video apps", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "Window peeper video questions" });
  const tiktok = within(faq).getByText("Can I post it on TikTok, Reels or Shorts?").closest("details") as HTMLElement;
  expect(tiktok.textContent).toContain("vertical 9:16");
});

// The site's names and the three steps, for search engines, as the page shows them.
test.each(["en", "zh"] as const)("the site and the steps are structured data in %s", (locale) => {
  renderWithIntl(<Page />, locale);

  const items = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    JSON.parse(script.textContent ?? ""),
  );
  // No example clip yet, so no VideoObject.
  expect(items.find((item) => item["@type"] === "VideoObject")).toBeUndefined();
  const site = items.find((item) => item["@graph"])["@graph"].find((node: { "@type": string }) => node["@type"] === "WebSite");
  expect(site.alternateName).toEqual(["Window Peeper AI Video Generator", "AI Window Peeper Video Generator"]);
  const howTo = items.find((item) => item["@type"] === "HowTo");
  const steps = screen.getByRole("heading", { level: 3, name: locale === "en" ? "Upload your photo" : "上传照片" }).closest("ol") as HTMLElement;
  expect(howTo.step.map((step: { name: string }) => step.name)).toEqual(
    within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  );
});

test("the closing call to action leads back up to the generator", () => {
  renderWithIntl(<Page />);

  const cta = screen.getByRole("region", { name: "Your turn in the window." });
  expect(within(cta).getByRole("link", { name: "Make my video" }).getAttribute("href")).toBe("#generator");
  expect(within(cta).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "One photo, a 12-second video",
    "Credits back if it fails",
    "English, Español, Deutsch and 中文",
  ]);
});

// The page targets the searches around the trend.
test("names the searches people use for the trend", () => {
  renderWithIntl(<Page />);

  const text = (document.body.textContent ?? "").toLowerCase();
  for (const query of ["window peeper ai", "window peeper trend", "window peeper filter", "window peeper effect", "capcut window peeper template"]) {
    expect(text).toContain(query);
  }
});

test.each([
  ["es", "Video de window peeper con IA — Que te pillen en la ventana con una sola foto.", "Haz tu video de window peeper"],
  ["de", "Window-Peeper-KI-Video — Lass dich mit einem Foto im Fenster erwischen.", "Mach dein Window-Peeper-Video"],
] as const)("renders in %s, the h1 and the generator translated", (locale, h1, generator) => {
  renderWithIntl(<Page />, locale);

  expect(screen.getByRole("heading", { level: 1, name: h1 })).toBeDefined();
  expect(screen.getByRole("region", { name: generator })).toBeDefined();
});

test("renders in Chinese", () => {
  renderWithIntl(<Page />, "zh");

  expect(
    screen.getByRole("heading", { level: 1, name: "Window Peeper AI 视频 — 一张照片，让你在窗口被“抓包”。" }),
  ).toBeDefined();
  expect(screen.getByRole("region", { name: "制作你的 Window Peeper 视频" })).toBeDefined();
});

// Search engines read the FAQ the page shows, word for word, without links.
test.each(["en", "zh"] as const)("the FAQ is structured data in %s, the same questions and answers", (locale) => {
  renderWithIntl(<Page />, locale);

  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  const data = scripts.map((script) => JSON.parse(script.textContent ?? "")).find((item) => item["@type"] === "FAQPage");
  const rows = [...document.querySelectorAll("details")].map((row) => ({
    question: row.querySelector("summary span:nth-child(2)")?.textContent,
    answer: row.querySelector("p")?.textContent,
  }));
  expect(rows).toHaveLength(12);
  expect(data).toEqual({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: rows.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  });
  // No ICU or markup left over.
  for (const { answer } of rows) expect(answer).not.toMatch(/[<>{}]/);
});
