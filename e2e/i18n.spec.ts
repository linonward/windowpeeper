import { expect, test } from "@playwright/test";

test("English pages have no prefix; /en redirects to them", async ({ page, request }) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(200);
  await page.goto("/pricing");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  for (const [from, to] of [
    ["/en", "/"],
    ["/en/pricing", "/pricing"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBeGreaterThanOrEqual(300);
    expect(response.status(), from).toBeLessThan(400);
    expect(new URL(response.headers().location, "http://x").pathname, from).toBe(to);
  }
});

test("switching back to English from another language drops the prefix", async ({ page }) => {
  await page.goto("/es/pricing");

  await page.getByRole("contentinfo").getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL("/pricing");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("switches language and keeps the page", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByRole("contentinfo").getByRole("link", { name: "Español" }).click();

  await expect(page).toHaveURL("/es/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión en WindowPeeper" })).toBeVisible();
});

test("switches language from the header's menu and keeps the page", async ({ page }) => {
  await page.goto("/pricing");

  await page.getByRole("banner").getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("menuitem", { name: "Deutsch" }).click();

  await expect(page).toHaveURL("/de/pricing");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("banner").getByRole("button", { name: "Sprache: Deutsch" })).toHaveText("DE");
});

test("switches language from the phone menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/pricing");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Español" }).click();

  await expect(page).toHaveURL("/es/pricing");
});

// Chinese was dropped; its old links land on the English pages.
test("old Chinese links go to the English pages", async ({ page, request }) => {
  const response = await request.get("/zh/pricing", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/pricing");

  await page.goto("/zh");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "中文" })).toHaveCount(0);
});

test("switches to Spanish and German from the footer's languages", async ({ page }) => {
  await page.goto("/sign-in");

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
  await expect(page.getByRole("heading", { name: "Esta ventana está a oscuras." })).toBeVisible();
});
