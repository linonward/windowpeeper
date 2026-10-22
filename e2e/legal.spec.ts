import { expect, test } from "@playwright/test";

const pages = [
  { path: "/en/privacy", heading: "Privacy Policy" },
  { path: "/en/terms", heading: "Terms of Service" },
  { path: "/en/refund", heading: "Refund Policy" },
  { path: "/es/privacy", heading: "Política de privacidad" },
  { path: "/es/terms", heading: "Términos del servicio" },
  { path: "/es/refund", heading: "Política de reembolsos" },
];

for (const { path, heading } of pages) {
  test(`${path} renders the ${heading}`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveTitle(`${heading} | WindowPeeper`);
    await expect(
      page.getByRole("main").getByRole("link", { name: "support@windowpeeper.org" }).last(),
    ).toHaveAttribute("href", "mailto:support@windowpeeper.org");
    await expect(page.getByRole("note")).toHaveCount(0);
  });
}

test("footer links to the legal pages in the current locale", async ({ page }) => {
  await page.goto("/es");

  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Reembolsos" }).click();

  await expect(page).toHaveURL("/es/refund");
  await expect(footer.getByRole("link", { name: "support@windowpeeper.org" })).toBeVisible();
});

test("legal pages share the visual system", async ({ page }) => {
  await page.goto("/en/privacy");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-family",
    /Big Shoulders/,
  );
});

test("document nav marks the current page and switches documents", async ({
  page,
}) => {
  await page.goto("/en/privacy");

  const nav = page.getByRole("navigation", { name: "Legal documents" });
  await expect(nav.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await nav.getByRole("link", { name: "Terms of Service" }).click();

  await expect(page).toHaveURL("/en/terms");
  await expect(
    page
      .getByRole("navigation", { name: "Legal documents" })
      .getByRole("link", { name: "Terms of Service" }),
  ).toHaveAttribute("aria-current", "page");
});

for (const width of [320, 375]) {
  test(`/es/privacy fits ${width}px without horizontal scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/es/privacy");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
