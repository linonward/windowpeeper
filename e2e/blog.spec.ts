import { expect, test } from "@playwright/test";

const POSTS = {
  en: ["Is it safe to upload your photo to an AI video generator?"],
};

test("the blog lists each locale's posts", async ({ page }) => {
  await page.goto("/en/blog");

  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  await expect(page).toHaveTitle("Blog: Guides and News | WindowPeeper");
  for (const title of POSTS.en) await expect(page.getByRole("main").getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("No posts yet.");

  // No post is translated into Spanish yet.
  await page.goto("/es/blog");
  await expect(page.getByRole("main")).toContainText("Todavía no hay publicaciones.");
});

test("a post opens from the list and describes itself for search", async ({ page }) => {
  await page.goto("/en/blog");
  await page.getByRole("main").getByRole("link", { name: POSTS.en[0] }).click();

  await expect(page).toHaveURL("/en/blog/is-it-safe-to-upload-a-photo");
  await expect(page.getByRole("heading", { level: 1, name: POSTS.en[0] })).toBeVisible();
  await expect(page).toHaveTitle(POSTS.en[0]);
  // No translation, so no other language is linked.
  await expect(page.locator('head link[rel="alternate"][hreflang="es"]')).toHaveCount(0);
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(scripts.map((text) => JSON.parse(text)).find((data) => data["@type"] === "BlogPosting")).toMatchObject({
    headline: POSTS.en[0],
    datePublished: "2026-10-22",
  });
});

for (const locale of ["en"] as const) {
  test(`a post fits a 320px phone in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(`/${locale}/blog/is-it-safe-to-upload-a-photo`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("a tag lists the locale's posts with it", async ({ page }) => {
  await page.goto("/en/blog/tags/guides");

  await expect(page.getByRole("main").getByRole("link", { name: POSTS.en[0] })).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
});

test("a post that doesn't exist gets the 404 page", async ({ page }) => {
  await page.goto("/es/blog/photo-to-video-ai");

  await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
});

test("the header links to the blog in the current locale", async ({ page }) => {
  await page.goto("/es");
  await page.getByRole("banner").getByRole("link", { name: "Blog" }).click();

  await expect(page).toHaveURL("/es/blog");
});

test("a tag no post in the locale has gets the 404 page", async ({ page }) => {
  await page.goto("/es/blog/tags/guides");

  await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
});
