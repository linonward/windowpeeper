import { expect, test } from "@playwright/test";

// The guides answer searches about the trend and lead to the generator on the
// home page; they have no generator of their own.
const GUIDES = [
  { slug: "how-to-make-window-peeper-video", en: "How to make a window peeper video", es: "Cómo hacer un video de window peeper" },
] as const;

for (const guide of GUIDES) {
  for (const locale of ["en", "es"] as const) {
    test(`/${locale}/${guide.slug} leads to the home generator`, async ({ page }) => {
      await page.goto(`/${locale}/${guide.slug}`);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(guide[locale]);
      await expect(page.getByRole("main").locator('input[type="file"]')).toHaveCount(0);
      // The first of the calls to action, at the top.
      const cta = page
        .getByRole("main")
        .getByRole("link", { name: locale === "en" ? "Make my video" : "Crear mi video" })
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

// German: long words must still fit a phone. English and Spanish are above.
for (const guide of GUIDES) {
  for (const locale of ["de"] as const) {
    test(`/${locale}/${guide.slug} fits a 320px phone without horizontal scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 812 });
      await page.goto(`/${locale}/${guide.slug}`);

      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("the footer links the how-to guide", async ({ page }) => {
  await page.goto("/es");

  const learn = page.getByRole("contentinfo").getByRole("navigation", { name: "Aprende" });
  await learn.getByRole("link", { name: "Cómo hacerlo" }).click();

  await expect(page).toHaveURL("/es/how-to-make-window-peeper-video");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cómo hacer un video de window peeper");
});
