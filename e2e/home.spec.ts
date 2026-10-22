import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test("hero states the value over the dance, with the generator starting in the first screen", async ({ page }) => {
  await page.goto("/en");

  await expect(page).toHaveTitle("Rumpelstiltskin Meme AI Video – Tiptoeing in My Jordans");
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    "Star in the Rumpelstiltskin meme: upload one photo and get the 12-second Tiptoeing in My Jordans video for TikTok. Free preview, pay once, no subscription.",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Rumpelstiltskin meme AI video — Star in Tiptoeing in My Jordans with one photo.",
    }),
  ).toBeVisible();
  // The dance plays full width behind the headline; the photo zone shows
  // under it in the first screen.
  await expect(page.getByRole("region", { name: "Make your window peeper video" }).getByText("Choose a photo")).toBeInViewport();
});

test("on a phone, the photo zone shows in the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  await expect(page.getByRole("region", { name: "Make your window peeper video" }).getByText("Choose a photo")).toBeInViewport();
});

test("the example dance plays beside the generator, served from public/", async ({ page, request }) => {
  await page.goto("/en");

  const video = page.getByRole("region", { name: "What your video looks like" }).locator("video");
  await expect(video).toBeInViewport();
  const response = await request.get((await video.getAttribute("src")) as string);
  expect(response.headers()["content-type"]).toBe("video/mp4");
});

test("the header offers sign-in to visitors and the dashboard once signed in", async ({
  page,
}) => {
  await page.goto("/en");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/en/sign-in");

  await signIn(page);
  await page.goto("/en/pricing");
  await expect(banner.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL("/en/videos/windowpeeper");
});

test("landing has the example, steps, pricing, FAQ and a closing call to action back to the generator", async ({
  page,
}) => {
  await page.goto("/en");

  for (const name of [
    "What your video looks like",
    "Three steps to a dancing photo",
    "Start with one video.",
    "AI Rumpelstiltskin video questions",
    "Your turn to tiptoe.",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await page.getByRole("link", { name: "Make my video" }).click();
  await expect(page).toHaveURL("/en#generator");
  await expect(page.getByRole("region", { name: "Make your window peeper video" }).getByText("Choose a photo")).toBeInViewport();
});

test("the header's links scroll to the home page's sections", async ({ page }) => {
  await page.goto("/en/blog");
  const banner = page.getByRole("banner");

  for (const [link, heading] of [
    ["Pricing", "Start with one video."],
    ["How it works", "Three steps to a dancing photo"],
    ["FAQ", "AI Rumpelstiltskin video questions"],
  ]) {
    await banner.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeInViewport();
  }
});

test("FAQ answers open on click and include the support email", async ({
  page,
}) => {
  await page.goto("/en");

  const question = page.getByText("How do I contact support?");
  await question.click();

  await expect(
    page.getByRole("main").getByRole("link", { name: "support@airumpelstiltskinvideo.com" }),
  ).toBeVisible();
});

test("landing is translated", async ({ page }) => {
  await page.goto("/zh");

  await expect(
    page.getByRole("heading", { level: 1, name: "侏儒怪表情包 AI 视频 — 一张照片，主演 Tiptoeing in My Jordans。" }),
  ).toBeVisible();
});

test("keyboard users can skip to the main content", async ({ page }) => {
  await page.goto("/en");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");

  await expect(page).toHaveURL("/en#main-content");
});

for (const width of [320, 375]) {
  for (const locale of ["en", "zh", "es", "de"]) {
    test(`fits a ${width}px phone in ${locale} without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(`/${locale}`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("turns off icon motion for reduced motion", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto("/en");

  await expect(page.locator("summary svg.lucide-plus").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.close();
});

test("body uses the Geist font", async ({ page }) => {
  await page.goto("/en");

  await expect(page.locator("body")).toHaveCSS("font-family", /Geist/);
});
