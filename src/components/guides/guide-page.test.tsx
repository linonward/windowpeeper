import { cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { GuidePage } from "./guide-page";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props} />,
}));

afterEach(cleanup);

const facts = {
  credits: 10,
  proCredits: 20,
  packs: [{ credits: 10, amount: 990, currency: "usd" }],
  maxPickBytes: 10 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
};

function structuredData() {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    JSON.parse(script.textContent ?? ""),
  );
}

// Search engines and AI assistants read a guide as an article with a date,
// and its numbered steps as a HowTo.
test("a guide is an Article, and its steps a HowTo", () => {
  renderWithIntl(<GuidePage guide="how-to-make-window-peeper-video" facts={facts} />);

  const data = structuredData();
  const article = data.find((item) => item["@type"] === "Article");
  expect(article).toMatchObject({
    headline: "How to Make the Window Peeper Video",
    inLanguage: "en",
    datePublished: "2026-10-22",
    author: { "@type": "Organization", name: "WindowPeeper" },
  });
  const howTo = data.find((item) => item["@type"] === "HowTo");
  expect(howTo.step[0]).toMatchObject({ position: 1, name: "Pick a photo" });
  expect(howTo.step[0].text).toContain("choose a photo of yourself");
});

test("the trend guide is an Article and links the other guides", () => {
  renderWithIntl(<GuidePage guide="window-peeper-trend" facts={facts} />);

  expect(structuredData().find((item) => item["@type"] === "Article").headline).toBe("Window Peeper Trend Meaning, Explained");
  const related = document.querySelector('nav[aria-labelledby="guide-related"]') as HTMLElement;
  expect([...related.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
    "/how-to-make-window-peeper-video",
    "/window-peeper-capcut-template",
  ]);
});
