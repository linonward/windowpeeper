import { expect, test } from "@playwright/test";
import { getSession, signIn } from "./support/auth";

test("signed-out visitors are redirected before the page renders", async ({
  request,
}) => {
  const response = await request.get("/en/dashboard", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fdashboard");
});

test("the dashboard opens the window peeper video in a sidebar shell", async ({ page }) => {
  const email = await signIn(page);
  await page.goto("/en/dashboard");

  // /dashboard opens /videos, which opens the first photo effect.
  await expect(page).toHaveURL("/en/videos/windowpeeper");
  await expect(page.getByRole("heading", { level: 1, name: "Make a window peeper video" })).toBeVisible();
  const sidebar = page.getByRole("navigation", { name: "Dashboard navigation" });
  await expect(sidebar.getByRole("link", { name: "New video", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(email).first()).toBeVisible();
  // Marketing header and footer stay out of the app shell.
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("the account menu opens the profile and keeps the shell", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/videos");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Profile" }).click();

  await expect(page).toHaveURL("/en/profile");
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();
});

test("signs out from the account menu", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/videos");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL("/en/sign-in");
  expect(await getSession(page)).toBeNull();
});

test("on phones the sidebar opens from a menu button", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh/videos");

  const nav = page.getByRole("navigation", { name: "控制台导航" });
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "打开菜单" }).click();
  await expect(nav).toBeVisible();

  // The account menu opens above its button and stays on screen.
  await page.getByRole("button", { name: "账户菜单" }).click();
  const box = await page.getByRole("menu").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the account menu shows the balance and switches the language", async ({
  page,
}) => {
  const email = await signIn(page);
  await page.goto("/en/videos");

  await page.getByRole("button", { name: "Account menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText(email)).toBeVisible();
  // Subscriptions aren't sold: no plan, no upgrade.
  await expect(menu.getByText("Free", { exact: true })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "Upgrade" })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: "0 credits left" })).toBeVisible();

  // A click on a submenu trigger races Radix's pointer handling; the
  // keyboard opens it every time.
  await menu.getByRole("menuitem", { name: "Language: English" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("menuitem", { name: "中文" }).click();
  await expect(page).toHaveURL("/zh/videos/windowpeeper");
  await expect(page.getByRole("heading", { level: 1, name: "制作 Window Peeper 视频" })).toBeVisible();
});

test("the sidebar collapses to icons and stays collapsed after a reload", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/videos");
  const link = page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Billing" });
  const width = async () => (await link.boundingBox())?.width ?? 0;
  expect(await width()).toBeGreaterThan(100);

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect.poll(width).toBeLessThan(40);

  await page.reload();
  expect(await width()).toBeLessThan(40);
  // The loading skeleton draws the collapsed sidebar too: a script in the
  // server HTML marks <html> from the cookie before first paint.
  const html = await (await page.request.get("/en/videos")).text();
  expect(html).toContain('toggleAttribute("data-sidebar-collapsed"');
  await expect(page.locator("html")).toHaveAttribute("data-sidebar-collapsed", "");

  // Collapsed links still navigate.
  await link.click();
  await expect(page).toHaveURL("/en/billing");

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar-collapsed");
});
