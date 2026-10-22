import { expect, test } from "@playwright/test";

// The guides answer searches about the meme and lead to the generator on the
// home page; they have no generator of their own.
const GUIDES = [
  { slug: "tip-toe-in-my-jordans", en: "Tip Toe in My Jordans", zh: "Tip Toe in My Jordans" },
  { slug: "rumpelstiltskin-meme", en: "Rumpelstiltskin meme", zh: "侏儒怪表情包" },
  { slug: "how-to-make-rumpelstiltskin-video", en: "How to make a Rumpelstiltskin video", zh: "怎么做侏儒怪视频" },
  { slug: "who-is-rumpelstiltskin", en: "Who is Rumpelstiltskin?", zh: "侏儒怪是谁？" },
  { slug: "rumpelstiltskin-movie", en: "Rumpelstiltskin movie", zh: "侏儒怪电影" },
  { slug: "rumpelstiltskin-1987-movie", en: "Rumpelstiltskin 1987 movie", zh: "1987 年电影《侏儒怪》" },
  { slug: "rumpelstiltskin-dance-scene", en: "Rumpelstiltskin dance scene", zh: "侏儒怪跳舞片段" },
] as const;

for (const guide of GUIDES) {
  for (const locale of ["en", "zh"] as const) {
    test(`/${locale}/${guide.slug} leads to the home generator`, async ({ page }) => {
      await page.goto(`/${locale}/${guide.slug}`);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(guide[locale]);
      await expect(page.getByRole("main").locator('input[type="file"]')).toHaveCount(0);
      // The first of the calls to action, at the top.
      const cta = page
        .getByRole("main")
        .getByRole("link", { name: locale === "en" ? "Make my video" : "制作我的视频" })
        .first();
      await expect(cta).toHaveAttribute("href", `/${locale}#generator`);

      await cta.click();
      await expect(page).toHaveURL(`/${locale}#generator`);
      await expect(page.locator("#generator")).toBeInViewport();
    });

    test(`/${locale}/${guide.slug} fits a 320px phone without horizontal scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 812 });
      await page.goto(`/${locale}/${guide.slug}`);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

// Spanish and German: long words (Rumpelstilzchen) must still fit a phone.
for (const guide of GUIDES) {
  for (const locale of ["es", "de"] as const) {
    test(`/${locale}/${guide.slug} fits a 320px phone without horizontal scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 812 });
      await page.goto(`/${locale}/${guide.slug}`);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("the footer links every guide", async ({ page }) => {
  await page.goto("/zh");

  const guides = page.getByRole("contentinfo").getByRole("navigation", { name: "指南" });
  await guides.getByRole("link", { name: "怎么做侏儒怪视频" }).click();

  await expect(page).toHaveURL("/zh/how-to-make-rumpelstiltskin-video");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("怎么做侏儒怪视频");
});
