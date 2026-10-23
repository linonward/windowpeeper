import { expect, type Page, test } from "@playwright/test";
import { randomIp, readMagicLink, signIn, uniqueEmail } from "./support/auth";

// CREDIT_PACKS (src/server/payment/packs.ts) and the window peeper video's prices
// (src/server/videos/window-peeper.ts).
const PACKS = [
  ["Single", "$5.90", "Any of the 6 scenes"],
  ["5-pack", "$19.90", "5 Standard or 2 Pro videos"],
  ["25-pack", "$69.90", "$2.80 a video, save 53%"],
];
const cardsIn = (page: Page) => page.locator('[aria-labelledby="pricing-packs"] > ul > li');

test("signed-out visitors see the price list: the packs, what a video costs and the promises", async ({ page }) => {
  const response = await page.goto("/pricing");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Pay for the videos you make" })).toBeVisible();
  await expect(page).toHaveTitle("Window Peeper Video Pricing – From $5.90 | WindowPeeper");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^Window peeper videos from \$5\.90:/);
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
  await expect(cards.nth(1).getByRole("button")).toHaveText("Buy 5 videos");
});

// Payments are off in E2E, so checkout answers PAYMENTS_DISABLED and the
// button says so; with payments on, the browser goes to the provider.
const checkoutFrom = (page: Page) =>
  page.waitForRequest((request) => request.url().endsWith("/api/payment/checkout") && request.method() === "POST");

test("a signed-in buyer opens checkout straight from the price list", async ({ page }) => {
  await signIn(page);
  await page.goto("/pricing");

  const checkout = checkoutFrom(page);
  await page.getByRole("button", { name: "Buy 250 credits for $69.90" }).click();

  expect((await checkout).postDataJSON()).toEqual({ packId: "large", locale: "en", returnTo: "pricing" });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Payments aren't set up yet.");
  await expect(page).toHaveURL("/pricing");
});

test("a signed-out visitor signs in on the price list, then checkout opens for the pack", async ({ page }) => {
  const email = uniqueEmail();
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Buy 10 credits for $5.90" }).click();

  const dialog = page.getByRole("dialog", { name: "Sign in to buy credits" });
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.goto(await readMagicLink(email));
  const checkout = checkoutFrom(page);
  await page.getByRole("button", { name: "Continue signing in" }).click();

  expect((await checkout).postDataJSON()).toEqual({ packId: "small", locale: "en", returnTo: "pricing" });
  await expect(page).toHaveURL("/pricing");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Payments aren't set up yet.");
});

test("back from checkout, the price list says how it went", async ({ page }) => {
  await page.goto("/pricing?checkout=success");

  await expect(page.getByRole("status")).toContainText("Payment received. Your credits arrive within a minute.");
  await expect(page).toHaveURL("/pricing");
});

test("the home page's packs open checkout and come back to them", async ({ page }) => {
  await signIn(page);
  await page.goto("/");

  const checkout = checkoutFrom(page);
  await page.locator("#pricing").getByRole("button", { name: "Buy 50 credits for $19.90" }).click();

  expect((await checkout).postDataJSON()).toEqual({ packId: "medium", locale: "en", returnTo: "packs" });
});

test("renders in Spanish, linked from the footer", async ({ page }) => {
  await page.goto("/es");
  await page.getByRole("contentinfo").getByRole("link", { name: "Precios" }).click();

  await expect(page).toHaveURL("/es/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Paga por los videos que haces" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("5 videos Estándar o 2 Pro");
});
