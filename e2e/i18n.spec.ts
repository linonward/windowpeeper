import { expect, test } from "@playwright/test";

test("sends / to the default locale", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("renders Chinese under /zh", async ({ page }) => {
  await page.goto("/zh/sign-in");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await expect(page).toHaveTitle("登录 | AIRumpelstiltskinVideo");
});

test("switches language and keeps the page", async ({ page }) => {
  await page.goto("/en/sign-in");

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("menuitem", { name: "中文" }).click();

  await expect(page).toHaveURL("/zh/sign-in");
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
});

test("switches to Spanish and German from the language menu", async ({ page }) => {
  await page.goto("/en/sign-in");

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("menuitem", { name: "Español" }).click();
  await expect(page).toHaveURL("/es/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page).toHaveTitle("Iniciar sesión | AIRumpelstiltskinVideo");

  await page.goto("/de/privacy");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Datenschutzerklärung");
});

test("keeps the locale when redirecting to sign-in", async ({ page }) => {
  await page.goto("/zh/profile");

  await expect(page).toHaveURL("/zh/sign-in?next=%2Fzh%2Fprofile");
});

test("shows a translated 404 for unknown pages", async ({ page }) => {
  const response = await page.goto("/zh/does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
});
