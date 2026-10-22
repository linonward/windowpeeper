import { projectConfig } from "project.config";
import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Footer } from "./footer";

// The root layout renders dark by default.
beforeEach(() => {
  document.documentElement.className = "dark";
});

afterEach(cleanup);

test("the product links lead to pricing and the blog", () => {
  renderWithIntl(<Footer />);

  const product = screen.getByRole("navigation", { name: "Product" });
  expect(within(product).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
    "/en/pricing",
    "/en/blog",
  ]);
});

test("the guides column links each guide, without naming the meme's nickname", () => {
  renderWithIntl(<Footer />);

  const guides = screen.getByRole("navigation", { name: "Guides" });
  expect(within(guides).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["The tip-toe dance meme trend", "/en/tip-toe-in-my-jordans"],
    ["What is the Rumpelstiltskin meme?", "/en/rumpelstiltskin-meme"],
    ["How to make a Rumpelstiltskin video", "/en/how-to-make-rumpelstiltskin-video"],
    ["Who is Rumpelstiltskin?", "/en/who-is-rumpelstiltskin"],
    ["Every Rumpelstiltskin movie", "/en/rumpelstiltskin-movie"],
    ["Is the clip from the 1987 movie?", "/en/rumpelstiltskin-1987-movie"],
    ["The dance scene, beat by beat", "/en/rumpelstiltskin-dance-scene"],
  ]);
});

test.each([
  ["en", "Report abuse", "Content report"],
  ["zh", "举报", "内容举报"],
] as const)("support offers a report link in %s, an email with its subject", (locale, name, subject) => {
  renderWithIntl(<Footer />, locale);

  const support = screen.getByRole("navigation", { name: locale === "en" ? "Support" : "支持" });
  expect(within(support).getByRole("link", { name }).getAttribute("href")).toBe(
    `mailto:${projectConfig.supportEmail}?subject=${encodeURIComponent(subject)}`,
  );
});

test("groups support and legal links under headings", () => {
  renderWithIntl(<Footer />);

  const support = screen.getByRole("navigation", { name: "Support" });
  expect(within(support).getByRole("link", { name: "support@airumpelstiltskinvideo.com" }).getAttribute("href")).toBe(
    "mailto:support@airumpelstiltskinvideo.com",
  );
  const legal = screen.getByRole("navigation", { name: "Legal" });
  expect(within(legal).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
    "/en/privacy",
    "/en/terms",
    "/en/refund",
  ]);
});

test("shows the brand, a blurb, the copyright and the theme switch", () => {
  renderWithIntl(<Footer />);

  expect(screen.getByRole("link", { name: "AIRumpelstiltskinVideo" }).getAttribute("href")).toBe("/en");
  expect(screen.getByText("AI Rumpelstiltskin tip-toe dance videos from one photo.")).toBeDefined();
  expect(screen.getByText("© AIRumpelstiltskinVideo. All rights reserved.")).toBeDefined();
  expect(screen.getByRole("group", { name: "Theme" })).toBeDefined();
});

test("is translated", () => {
  renderWithIntl(<Footer />, "zh");

  expect(screen.getByRole("navigation", { name: "支持" })).toBeDefined();
  expect(screen.getByText("© AIRumpelstiltskinVideo，保留所有权利。")).toBeDefined();
});
