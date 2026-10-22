import { expect, test } from "@playwright/test";

const POSTS = {
  en: [
    "Meet the AI Rumpelstiltskin video generator",
    "Turn a 16:9 video into 9:16 for TikTok, Reels and Shorts",
    "Is it safe to upload your photo to an AI video generator?",
  ],
  zh: [
    "认识 AI 侏儒怪视频生成器",
    "怎样把 16:9 视频改成 9:16，发到 TikTok、Reels 和 Shorts",
    "把照片上传到 AI 视频生成器安全吗？",
  ],
};

test("the blog lists each locale's posts", async ({ page }) => {
  await page.goto("/en/blog");

  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  await expect(page).toHaveTitle("Blog: Guides and News | AIRumpelstiltskinVideo");
  for (const title of POSTS.en) await expect(page.getByRole("main").getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("No posts yet.");

  await page.goto("/zh/blog");
  for (const title of POSTS.zh) await expect(page.getByRole("main").getByRole("link", { name: title })).toBeVisible();
});

test("a post opens from the list, links its translation and describes itself for search", async ({ page }) => {
  await page.goto("/en/blog");
  await page.getByRole("main").getByRole("link", { name: POSTS.en[1] }).click();

  await expect(page).toHaveURL("/en/blog/turn-16-9-video-into-9-16-for-tiktok");
  await expect(page.getByRole("heading", { level: 1, name: POSTS.en[1] })).toBeVisible();
  await expect(page).toHaveTitle(POSTS.en[1]);
  await expect(page.locator('head link[rel="alternate"][hreflang="zh"]')).toHaveAttribute(
    "href",
    /\/zh\/blog\/turn-16-9-video-into-9-16-for-tiktok$/,
  );
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(scripts.map((text) => JSON.parse(text)).find((data) => data["@type"] === "BlogPosting")).toMatchObject({
    headline: POSTS.en[1],
    datePublished: "2026-10-17",
  });
});

for (const locale of ["en", "zh"] as const) {
  test(`the post with ffmpeg commands fits a 320px phone in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(`/${locale}/blog/turn-16-9-video-into-9-16-for-tiktok`);

    await expect(page.locator("pre").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("a tag lists the locale's posts with it", async ({ page }) => {
  await page.goto("/en/blog/tags/guides");

  await expect(page.getByRole("main").getByRole("link", { name: POSTS.en[1] })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: POSTS.en[0] })).toHaveCount(0);
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
});

test("a post that doesn't exist gets the 404 page", async ({ page }) => {
  await page.goto("/zh/blog/photo-to-video-ai");

  await expect(page.getByRole("heading", { level: 1, name: "页面不存在" })).toBeVisible();
});

test("the header links to the blog in the current locale", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("banner").getByRole("link", { name: "博客" }).click();

  await expect(page).toHaveURL("/zh/blog");
});

test("a tag no post in the locale has gets the 404 page", async ({ page }) => {
  await page.goto("/zh/blog/tags/guides");

  await expect(page.getByRole("heading", { level: 1, name: "页面不存在" })).toBeVisible();
});
