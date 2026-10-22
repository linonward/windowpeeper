import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/auth";

// CREDIT_PACKS (src/server/payment/packs.ts) and the window peeper video's prices
// (src/server/videos/window-peeper.ts).
const PACKS = [
  ["Single", "$9.90", "Any of the 6 scenes"],
  ["5-pack", "$29.90", "5 Standard or 2 Pro videos"],
  ["25-pack", "$99.90", "$4.00 a video, save 60%"],
];
const cardsIn = (page: Page) => page.locator('[aria-labelledby="pricing-packs"] > ul > li');

test("signed-out visitors see the price list: the packs, what a video costs and the promises", async ({ page }) => {
  const response = await page.goto("/pricing");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Pay for the videos you make" })).toBeVisible();
  await expect(page).toHaveTitle("Window Peeper Video Pricing | WindowPeeper");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^Window peeper videos from \$9\.90:/);
  const cards = cardsIn(page);
  for (const [index, [name, price, line]] of PACKS.entries()) {
    const card = cards.nth(index);
    await expect(card.getByRole("heading", { level: 3 })).toHaveText(name);
    await expect(card).toContainText(price);
    await expect(card).toContainText(line);
  }
  await expect(page.getByRole("table")).toContainText("1080p · 9:16");
  await expect(page.getByRole("main")).toContainText("Failed video? Credits back");
  // Packs only: no plans, no free credits, and Pro is never sold as HD.
  await expect(page.getByRole("main")).not.toContainText(/subscribe|per month|per year|yearly|free credits|\bHD\b/i);
});

test("only the pack to start with is recommended", async ({ page }) => {
  await page.goto("/pricing");
  const main = page.getByRole("main");

  const cards = cardsIn(page);
  await expect(cards.nth(1)).toContainText("Recommended");
  await expect(cards.nth(0)).not.toContainText("Recommended");
  await expect(cards.nth(2)).not.toContainText("Recommended");
  await expect(main).not.toContainText(/most popular/i);
  await expect(cards.nth(1).getByRole("link")).toHaveText("Buy 5 videos");
});

test("buying opens billing for a signed-in user with the pack picked", async ({ page }) => {
  await signIn(page);
  await page.goto("/pricing");

  await page.getByRole("link", { name: "Buy 250 credits for $99.90" }).click();

  // Payments are off in E2E, so the pay button is disabled.
  await expect(page).toHaveURL("/billing?pack=large");
  await expect(page.getByRole("radio", { name: /25-pack/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Buy 250 credits for $99.90" })).toBeDisabled();
});

test("signed-out visitors keep their choice through sign-in", async ({ page, request }) => {
  await page.goto("/pricing");
  await page.getByRole("link", { name: "Buy 10 credits for $9.90" }).click();

  await expect(page).toHaveURL("/sign-in?next=%2Fbilling%3Fpack%3Dsmall");
  const response = await request.get("/billing?pack=small", { maxRedirects: 0 });
  expect(response.headers().location).toBe("/sign-in?next=%2Fbilling%3Fpack%3Dsmall");
});

test("renders in Spanish, linked from the footer", async ({ page }) => {
  await page.goto("/es");
  await page.getByRole("contentinfo").getByRole("link", { name: "Precios" }).click();

  await expect(page).toHaveURL("/es/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Paga por los videos que haces" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("5 videos Estándar o 2 Pro");
});
