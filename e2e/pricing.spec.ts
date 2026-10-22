import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/auth";

// CREDIT_PACKS (src/server/payment/packs.ts) and the tip-toe dance's prices
// (src/server/videos/tiptoe.ts): each pack is titled by the videos it buys.
const PACKS = [
  ["1 video", "$4.99", "10 credits"],
  ["1 Pro video", "$7.99", "or 2 videos"],
  ["3 videos", "$11.99", "$4.00 a video"],
];
// The cards, without the perks listed inside each.
const cardsIn = (page: Page) => page.getByRole("region", { name: "Pick your pack" }).locator(":scope > ul > li");

test("signed-out visitors see the meme's price list: the lowest price, the packs and what every pack includes", async ({ page }) => {
  const response = await page.goto("/en/pricing");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL("/en/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Rumpelstiltskin meme videos, from $4.99" })).toBeVisible();
  await expect(page).toHaveTitle("Rumpelstiltskin Meme Video Pricing | AIRumpelstiltskinVideo");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /^Rumpelstiltskin meme videos from \$4\.99:/);
  const cards = cardsIn(page);
  for (const [index, [title, price, line]] of PACKS.entries()) {
    const card = cards.nth(index);
    await expect(card.getByRole("heading", { level: 3 })).toHaveText(title);
    await expect(card).toContainText(price);
    await expect(card).toContainText(line);
  }
  await expect(page.getByRole("list", { name: "Every pack" })).toContainText("Credits back if a video fails");
  // Packs only: no plans, no free credits (the free preview is no credit),
  // and Pro is never sold as HD.
  await expect(page.getByRole("main")).not.toContainText(/subscribe|per month|per year|yearly|free credits|\bHD\b/i);
});

test("the pack to start with is recommended and the cheapest per video is the best value", async ({ page }) => {
  await page.goto("/en/pricing");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2 })).toHaveText(["Pick your pack", "Questions about paying"]);

  const cards = cardsIn(page);
  await expect(cards.nth(0)).toContainText("Recommended");
  await expect(cards.nth(1)).toContainText("Best value");
  await expect(cards.nth(2)).not.toContainText(/Recommended|Best value/);
  await expect(main).not.toContainText(/most popular/i);
  await expect(cards.nth(0).getByRole("link")).toHaveText("Buy for $4.99");
});

test("buying opens billing for a signed-in user", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/pricing");

  await page.getByRole("link", { name: "Buy 20 credits for $7.99" }).click();

  // Billing marks the chosen pack. Payments are off in E2E, so its button is
  // disabled and can't take focus; the card scrolls into view instead.
  await expect(page).toHaveURL("/en/billing?pack=medium");
  const buy = page.getByRole("button", { name: "Buy 20 credits for $7.99" });
  const card = page.getByRole("listitem").filter({ has: buy });
  await expect(card).toContainText("Selected");
  await expect(card).toContainText("1 Pro video or 2 videos");
  await expect(card).toBeInViewport();
});

test("signed-out visitors keep their choice through sign-in", async ({ page, request }) => {
  await page.goto("/en/pricing");
  await page.getByRole("link", { name: "Buy 10 credits for $4.99" }).click();

  await expect(page).toHaveURL("/en/sign-in?next=%2Fen%2Fbilling%3Fpack%3Dsmall");
  const response = await request.get("/en/billing?pack=small", { maxRedirects: 0 });
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fbilling%3Fpack%3Dsmall");
});

test("renders in Chinese, linked from the footer", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("contentinfo").getByRole("link", { name: "价格" }).click();

  await expect(page).toHaveURL("/zh/pricing");
  await expect(page.getByRole("heading", { level: 1, name: /^侏儒怪表情包视频，.*4\.99 起$/ })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("1 个 Pro 视频");
  await expect(main).toContainText("或 2 个视频");
  // The free preview is named; no plan or monthly charge is.
  await expect(main).not.toContainText(/订阅方案|免费积分|每月扣费/);
});

// Crawlers and readers reach the policies from the page body, not only from
// the footer.
test("the questions link the refund policy and the terms from the page body", async ({ page }) => {
  await page.goto("/en/pricing");
  const faq = page.getByRole("main").getByRole("region", { name: "Questions about paying" });

  await expect(faq.getByRole("link", { name: "refund policy" })).toHaveAttribute("href", "/en/refund");
  await expect(faq.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/en/terms");

  await faq.getByRole("link", { name: "refund policy" }).click();
  await expect(page).toHaveURL("/en/refund");
});
