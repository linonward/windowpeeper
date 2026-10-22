import { expect, test } from "@playwright/test";

test("sends / to the default locale", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("switches language and keeps the page", async ({ page }) => {
  await page.goto("/en/sign-in");

  await page.getByRole("contentinfo").getByRole("link", { name: "Español" }).click();

  await expect(page).toHaveURL("/es/sign-in");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

// Chinese was dropped; its old links land on the English pages.
test("old Chinese links go to the English pages", async ({ page, request }) => {
  const response = await request.get("/zh/pricing", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/en/pricing");

  await page.goto("/zh");
  await expect(page).toHaveURL("/en");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "中文" })).toHaveCount(0);
});

test("switches to Spanish and German from the footer's languages", async ({ page }) => {
  await page.goto("/en/sign-in");

  await page.getByRole("contentinfo").getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL("/es/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page).toHaveTitle("Iniciar sesión | WindowPeeper");

  await page.goto("/de/privacy");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Datenschutzerklärung");
});

test("keeps the locale when redirecting to sign-in", async ({ page }) => {
  await page.goto("/es/profile");

  await expect(page).toHaveURL("/es/sign-in?next=%2Fes%2Fprofile");
});

test("shows a translated 404 for unknown pages", async ({ page }) => {
  const response = await page.goto("/es/does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});
