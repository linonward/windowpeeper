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
      name: "Rumpelstiltskin meme AI video — Star in Tiptoeing in My Jordans with one photo.",
    }),
  ).toBeDefined();
});

test("the badge above the h1 names the brand and where the meme trends", () => {
  renderWithIntl(<Page />);

  const badge = screen.getByText("Now trending on TikTok").parentElement;
  expect(badge?.tagName).toBe("P");
  expect(badge?.textContent).toBe("AIRumpelstiltskinVideo Now trending on TikTok");
});

test("the generator sits in the hero, with the video's price on its button", () => {
  renderWithIntl(<Page />);

  const generator = screen.getByRole("region", { name: "Make your Rumpelstiltskin meme video" });
  expect(screen.getByRole("heading", { level: 1 }).closest("section")?.contains(generator)).toBe(true);
  expect(within(generator).getByLabelText("Your photo")).toBeDefined();
  expect(within(generator).getByRole("button", { name: /^Generate \(\d+ credits\)$/ })).toBeDefined();
});

// The dance plays full width behind the headline. It only sets the scene:
// screen readers skip it, and the example card holds the labeled clip. The
// generator follows the headline at once, with no buttons in between.
test("the hero plays the dance behind the headline, with no buttons before the generator", () => {
  renderWithIntl(<Page />);

  const hero = screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
  const backdrop = hero.querySelector("video[aria-hidden='true']") as HTMLVideoElement;
  expect(backdrop.getAttribute("src")).toBe("/landing/tiptoe/sample.mp4");
  expect(backdrop.muted && backdrop.loop && backdrop.autoplay).toBe(true);
  const generator = screen.getByRole("region", { name: "Make your Rumpelstiltskin meme video" });
  // Links in the hero belong to the generator (sign-in, terms), never above it.
  expect(within(hero).queryAllByRole("link").filter((link) => !generator.contains(link))).toEqual([]);
});

test("the sections follow the generator: the example, steps, the explainer, pricing, FAQ, then the closing call to action", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Make your Rumpelstiltskin meme video",
    "What your video looks like",
    "Three steps to a dancing photo",
    "About the Rumpelstiltskin AI video generator",
    "Start with one video.",
    "AI Rumpelstiltskin video questions",
    "Your turn to tiptoe.",
  ]);
});

// The headline spans the page; the generator and the example sit side by
// side under it.
test("the example video sits in the hero beside the generator", () => {
  renderWithIntl(<Page />);

  const hero = screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
  const example = within(hero).getByRole("region", { name: "What your video looks like" });
  const video = within(example).getByLabelText(/^The tip-toe scene:/);
  expect(video.getAttribute("src")).toBe("/landing/tiptoe/sample.mp4");
  expect(video.getAttribute("poster")).toBe("/landing/tiptoe/poster.jpg");
  expect(screen.getByRole("region", { name: "Make your Rumpelstiltskin meme video" }).nextElementSibling).toBe(example);
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

  const steps = screen.getByRole("region", { name: "Three steps to a dancing photo" });
  expect(within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Upload your photo",
    "We make it dance",
    "Download & share",
  ]);
});

test("FAQ questions are numbered and state the price from the config", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "AI Rumpelstiltskin video questions" });
  expect(within(faq).getByText("01")).toBeDefined();
  expect(within(faq).getByText("12")).toBeDefined();
  expect(within(faq).getByText("What is the Rumpelstiltskin AI video generator?")).toBeDefined();
  const cost = within(faq).getByText("How much does it cost?").closest("details") as HTMLElement;
  // CREDIT_PACKS and the tip-toe dance's prices, in dollars too.
  expect(cost.textContent).toContain(
    "A tip-toe video costs 10 credits. A Pro video, in sharper 1080p, costs 20 credits. " +
      "Credits come in one-time packs: 10 credits for $4.99, 20 credits for $7.99, and 30 credits for $11.99. " +
      "There is no subscription, and credits never expire. If a video fails, the credits are refunded.",
  );
  expect(within(cost).getByRole("link", { name: "pricing page" }).getAttribute("href")).toBe("/en/pricing");
});

// The long answer under the steps: one topic per h3, each sending readers to
// the guide that covers it in full.
test("the explainer answers the searches around the generator and links the guides", () => {
  renderWithIntl(<Page />);

  const about = screen.getByRole("region", { name: "About the Rumpelstiltskin AI video generator" });
  expect(within(about).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "What the generator makes",
    "A new video, not a face swap",
    "Where the tip-toe dance meme comes from",
    "Is it from the 1987 Rumpelstiltskin movie?",
    "Music and the tip toe sound",
    "Posting to TikTok, Reels and Shorts",
    "Standard or Pro",
  ]);
  const links = within(about)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
  expect(links).toEqual(
    expect.arrayContaining([
      "/en/rumpelstiltskin-meme",
      "/en/how-to-make-rumpelstiltskin-video",
      "/en/tip-toe-in-my-jordans",
      "#generator",
    ]),
  );
  expect(about.textContent?.split(/\s+/).length).toBeGreaterThan(600);
});

test("FAQ answers whether the video works on short-video apps", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "AI Rumpelstiltskin video questions" });
  const tiktok = within(faq).getByText("Can I post it on TikTok, Reels or Shorts?").closest("details") as HTMLElement;
  expect(tiktok.textContent).toContain("vertical 9:16");
});

// The example clip and the three steps, for search engines, as the page shows them.
test.each(["en", "zh"] as const)("the example clip and the steps are structured data in %s", (locale) => {
  renderWithIntl(<Page />, locale);

  const items = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    JSON.parse(script.textContent ?? ""),
  );
  const video = items.find((item) => item["@type"] === "VideoObject");
  expect(video).toMatchObject({ duration: "PT9S", inLanguage: locale });
  const site = items.find((item) => item["@graph"])["@graph"].find((node: { "@type": string }) => node["@type"] === "WebSite");
  expect(site.alternateName).toEqual(["AI Rumpelstiltskin Video Generator", "Rumpelstiltskin AI Video Generator"]);
  const howTo = items.find((item) => item["@type"] === "HowTo");
  const steps = screen.getByRole("heading", { level: 3, name: locale === "en" ? "Upload your photo" : "上传照片" }).closest("ol") as HTMLElement;
  expect(howTo.step.map((step: { name: string }) => step.name)).toEqual(
    within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  );
});

test("the closing call to action leads back up to the generator", () => {
  renderWithIntl(<Page />);

  const cta = screen.getByRole("region", { name: "Your turn to tiptoe." });
  expect(within(cta).getByRole("link", { name: "Make my video" }).getAttribute("href")).toBe("#generator");
  expect(within(cta).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "One photo, a 12-second video",
    "Credits back if it fails",
    "English, Español, Deutsch and 中文",
  ]);
});

// People search the meme by its nickname, so the page uses it; it names no
// brand, artist or song otherwise.
test("names the meme by its nickname, and no brand, artist or song", () => {
  renderWithIntl(<Page />);

  const text = document.body.textContent ?? "";
  expect(text).toContain("Tiptoeing in My Jordans");
  expect(text.replaceAll("Tiptoeing in My Jordans", "")).not.toMatch(/riff raff|nike|jordan/i);
});

test.each([
  ["es", "Video IA del meme de Rumpelstiltskin — Protagoniza Tiptoeing in My Jordans con una foto.", "Crea tu video del meme de Rumpelstiltskin"],
  ["de", "Rumpelstilzchen-Meme als KI-Video — Spiel mit einem Foto die Hauptrolle in Tiptoeing in My Jordans.", "Erstelle dein Rumpelstilzchen-Meme-Video"],
] as const)("renders in %s, the h1 and the generator translated", (locale, h1, generator) => {
  renderWithIntl(<Page />, locale);

  expect(screen.getByRole("heading", { level: 1, name: h1 })).toBeDefined();
  expect(screen.getByRole("region", { name: generator })).toBeDefined();
});

test("renders in Chinese", () => {
  renderWithIntl(<Page />, "zh");

  expect(
    screen.getByRole("heading", { level: 1, name: "侏儒怪表情包 AI 视频 — 一张照片，主演 Tiptoeing in My Jordans。" }),
  ).toBeDefined();
  expect(screen.getByRole("region", { name: "做你的侏儒怪表情包视频" })).toBeDefined();
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
