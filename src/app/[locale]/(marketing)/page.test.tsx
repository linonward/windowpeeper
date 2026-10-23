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
// tagline. The REC badge above it isn't a heading.
test("the only h1 is the large headline: the query, then the tagline", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", { level: 1, name: "Window peeper AI video generator — Someone's watching you eat." }),
  ).toBeDefined();
  expect(screen.getByText("Now trending on TikTok · Reels · Shorts").tagName).toBe("SPAN");
});

test("the generator sits in the hero, with the photo, the scenes and one button", () => {
  renderWithIntl(<Page />);

  const generator = screen.getByRole("region", { name: "Make your window peeper video" });
  expect(generator.id).toBe("generator");
  expect(screen.getByRole("heading", { level: 1 }).closest("section")?.contains(generator)).toBe(true);
  expect(within(generator).getByLabelText("Add your photo", { selector: "input" })).toBeDefined();
  expect(within(generator).getAllByRole("radio")).toHaveLength(6);
  expect(within(generator).getByRole("button", { name: "Make my video" })).toBeDefined();
  // The smallest pack's price, from the config.
  expect(generator.textContent).toContain("From $5.90 for one video");
});

// A real clip, made from an AI-generated person, and the page says so.
test("the hero plays the example clip from public/, and says the person is AI-generated", () => {
  renderWithIntl(<Page />);

  const hero = screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
  const video = hero.querySelector("video") as HTMLVideoElement;
  expect(video.getAttribute("src")).toBe("/landing/windowpeeper/sample.mp4");
  expect(video.getAttribute("poster")).toBe("/landing/windowpeeper/poster.jpg");
  expect(video.getAttribute("aria-label")).toContain("The person is AI-generated.");
  expect(hero.textContent).toContain("A real video made here. The person in it is AI-generated.");
});

test("the sections follow the boards: before/after, scenes, steps, pricing, shot list, FAQ, then the closing call", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "One photo. You, in the window.",
    "Pick your window",
    "How to do the window peeper trend",
    "Start with one video.",
    "14 seconds, five beats",
    "Window peeper AI video questions",
    "Your window is open.",
  ]);
});

test("the scenes section shows the six windows, each leading to the generator", () => {
  renderWithIntl(<Page />);

  const scenes = screen.getByRole("region", { name: "Pick your window" });
  expect(scenes.id).toBe("scenes");
  expect(within(scenes).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Burger at night",
    "Midnight noodles",
    "Pizza slice",
    "Caught and wave",
    "Through the glass",
    "Couple dinner",
  ]);
  const use = within(scenes).getByRole("link", { name: "Use the Pizza slice scene" });
  expect(use.getAttribute("href")).toBe("#generator");
  expect(within(scenes).getByRole("link", { name: /See all scenes/ }).getAttribute("href")).toBe(
    "/how-to-make-window-peeper-video",
  );
});

// The packs from the config: the videos each buys, the price per video and
// what it saves; the recommended one is lit.
test("pricing lists the credit packs from the config, the recommended one lit", () => {
  renderWithIntl(<Page />);

  const pricing = screen.getByRole("region", { name: "Start with one video." });
  expect(pricing.id).toBe("pricing");
  const packs = Array.from(pricing.querySelector("ul")!.children) as HTMLElement[];
  expect(packs.map((pack) => pack.textContent)).toEqual([
    expect.stringContaining("Single · 1 video$5.90$5.90 a video"),
    expect.stringContaining("5-pack · 5 videosRecommended$19.90$3.98 a video · save 33%"),
    expect.stringContaining("25-pack · 25 videos$69.90$2.80 a video · save 53%"),
  ]);
  expect(within(pricing).getByRole("link", { name: "Make my video" }).getAttribute("href")).toBe("#generator");
  expect(within(pricing).getByRole("link", { name: /See full pricing/ }).getAttribute("href")).toBe("/pricing");
});

test("the steps go from a photo to a posted video", () => {
  renderWithIntl(<Page />);

  const steps = screen.getByRole("region", { name: "How to do the window peeper trend" });
  expect(within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Upload one photo",
    "Pick a window",
    "Download and post",
  ]);
});

test("the FAQ states the price and the photo size from the config", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "Window peeper AI video questions" });
  const pay = within(faq).getByText("Can I see the video before I pay?").closest("details") as HTMLElement;
  expect(pay.hasAttribute("open")).toBe(true);
  expect(pay.textContent).toContain("from $5.90 for one");
  const photos = within(faq).getByText("Which photos work best?").closest("details") as HTMLElement;
  expect(photos.textContent).toContain("up to 10 MB");
});

// The site's names and the three steps, for search engines, as the page shows them.
test.each(["en", "es"] as const)("the site and the steps are structured data in %s", (locale) => {
  renderWithIntl(<Page />, locale);

  const items = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    JSON.parse(script.textContent ?? ""),
  );
  const video = items.find((item) => item["@type"] === "VideoObject");
  expect(video).toMatchObject({ duration: "PT14S", uploadDate: "2026-10-23", inLanguage: locale });
  const site = items.find((item) => item["@graph"])["@graph"].find((node: { "@type": string }) => node["@type"] === "WebSite");
  expect(site.alternateName).toEqual(["Window Peeper AI Video Generator", "AI Window Peeper Video Generator"]);
  const howTo = items.find((item) => item["@type"] === "HowTo");
  const steps = document.querySelector("#how-it-works ol") as HTMLElement;
  expect(howTo.step.map((step: { name: string }) => step.name)).toEqual(
    within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  );
});

test("the closing call to action leads back up to the generator", () => {
  renderWithIntl(<Page />);

  const cta = screen.getByRole("region", { name: "Your window is open." });
  expect(within(cta).getByRole("link", { name: "Make my video" }).getAttribute("href")).toBe("#generator");
});

// The page targets the searches around the trend.
test("names the searches people use for the trend", () => {
  renderWithIntl(<Page />);

  const text = (document.body.textContent ?? "").toLowerCase();
  for (const query of ["window peeper ai", "window peeper trend", "window peeper filter", "capcut template"]) {
    expect(text).toContain(query);
  }
});

test.each(["es", "de", "es"] as const)("renders in %s, the h1 and the generator translated", (locale) => {
  renderWithIntl(<Page />, locale);

  expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("Someone's watching you eat.");
  expect(document.querySelector("#generator")).not.toBeNull();
});

// Search engines read the FAQ the page shows, word for word.
test.each(["en", "es"] as const)("the FAQ is structured data in %s, the same questions and answers", (locale) => {
  renderWithIntl(<Page />, locale);

  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  const data = scripts.map((script) => JSON.parse(script.textContent ?? "")).find((item) => item["@type"] === "FAQPage");
  const rows = [...document.querySelectorAll("#faq details")].map((row) => ({
    question: row.querySelector("summary span")?.textContent,
    answer: row.querySelector("p")?.textContent,
  }));
  expect(rows).toHaveLength(9);
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
});

// Google's OAuth review reads the home page: it must say what the app is
// for, that uploads are of yourself only, and how Google data is used.
test("the home page says what the app is for and who may be in the photo", () => {
  renderWithIntl(<Page />);

  expect(screen.getAllByText(/AI video generator for the window peeper TikTok meme/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/PG-rated/).length).toBeGreaterThan(0);
  const steps = screen.getByRole("region", { name: "How to do the window peeper trend" });
  expect(steps.textContent).toContain("A photo of yourself only");
  expect(steps.textContent).not.toContain("permission");
});

test("the FAQ covers safety and Google data", () => {
  renderWithIntl(<Page />);

  const faq = screen.getByRole("region", { name: "Window peeper AI video questions" });
  const safety = within(faq).getByText("Is WindowPeeper safe? What can it make?").closest("details") as HTMLElement;
  expect(safety.textContent).toContain("no prompts");
  expect(safety.textContent).toContain("support@windowpeeper.org");
  const google = within(faq).getByText("How do you use my Google data?").closest("details") as HTMLElement;
  expect(google.textContent).toContain("name, email address and profile picture");
  expect(google.textContent).toContain("Google Photos, Drive");
});
