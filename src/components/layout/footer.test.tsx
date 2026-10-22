import { projectConfig } from "project.config";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Footer } from "./footer";

// The language links read the current path, which jsdom doesn't provide.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/en/pricing",
}));

afterEach(cleanup);

const links = (name: string) =>
  within(screen.getByRole("navigation", { name }))
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);

test("the product column leads to the generator, the scenes and pricing", () => {
  renderWithIntl(<Footer />);

  expect(links("Product")).toEqual([
    ["Make a video", "/en#generator"],
    ["Scenes", "/en#scenes"],
    ["Pricing", "/en/pricing"],
  ]);
});

test("the learn column leads to the FAQ, the guide and the blog", () => {
  renderWithIntl(<Footer />);

  expect(links("Learn")).toEqual([
    ["Window peeper trend", "/en#faq"],
    ["How to make it", "/en/how-to-make-window-peeper-video"],
    ["Is there a filter?", "/en#faq"],
    ["Blog", "/en/blog"],
  ]);
});

test("the legal column links each document; acceptable use is in the terms", () => {
  renderWithIntl(<Footer />);

  expect(links("Legal")).toEqual([
    ["Terms", "/en/terms"],
    ["Privacy", "/en/privacy"],
    ["Refunds", "/en/refund"],
    ["Acceptable use", "/en/terms"],
  ]);
});

test("the bottom bar has the copyright, the support email and every language on this page", () => {
  renderWithIntl(<Footer />);

  expect(screen.getByText(`© ${new Date().getFullYear()} WindowPeeper`, { exact: false })).toBeTruthy();
  expect(screen.getByRole("link", { name: projectConfig.supportEmail }).getAttribute("href")).toBe(
    `mailto:${projectConfig.supportEmail}`,
  );
  expect(links("Language")).toEqual([
    ["English", "/en/pricing"],
    ["中文", "/zh/pricing"],
    ["Español", "/es/pricing"],
    ["Deutsch", "/de/pricing"],
  ]);
});
