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

test("the guides column links each guide", () => {
  renderWithIntl(<Footer />);

  const guides = screen.getByRole("navigation", { name: "Guides" });
  expect(within(guides).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["How to make a window peeper video", "/en/how-to-make-window-peeper-video"],
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
  expect(within(support).getByRole("link", { name: "support@windowpeeper.org" }).getAttribute("href")).toBe(
    "mailto:support@windowpeeper.org",
  );
  const legal = screen.getByRole("navigation", { name: "Legal" });
  expect(within(legal).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
    "/en/privacy",
    "/en/terms",
    "/en/refund",
  ]);
});

test("shows the brand, a blurb and the copyright, with no theme switch", () => {
  renderWithIntl(<Footer />);

  expect(screen.getByRole("link", { name: "WindowPeeper" }).getAttribute("href")).toBe("/en");
  expect(screen.getByText("Window peeper trend videos from one photo.")).toBeDefined();
  expect(screen.getByText("© WindowPeeper. All rights reserved.")).toBeDefined();
  // Dark only (docs/DESIGN.md, Visual Identity).
  expect(screen.queryByRole("group", { name: "Theme" })).toBeNull();
});

test("is translated", () => {
  renderWithIntl(<Footer />, "zh");

  expect(screen.getByRole("navigation", { name: "支持" })).toBeDefined();
  expect(screen.getByText("© WindowPeeper，保留所有权利。")).toBeDefined();
});
