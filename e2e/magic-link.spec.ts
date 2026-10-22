import { expect, test } from "@playwright/test";
import { getSession, randomIp, readMagicLink, uniqueEmail } from "./support/auth";

test("signs in with a magic link", async ({ page }) => {
  const email = uniqueEmail();
  // Its own client IP: other tests' page loads share the default one, and
  // Better Auth rate-limits per IP.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));
  await page.getByRole("button", { name: "Continue signing in" }).click();

  // Sign-in returns to /videos, which opens the window peeper video.
  await expect(page).toHaveURL("/videos/windowpeeper");
  expect((await getSession(page))?.user.email).toBe(email);
});

test("returns to the page that asked for sign-in", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/billing");
  await expect(page).toHaveURL("/sign-in?next=%2Fbilling");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));
  await page.getByRole("button", { name: "Continue signing in" }).click();

  await expect(page).toHaveURL("/billing");
});

test("opening the link alone, as an email scanner does, signs nobody in and keeps the link usable", async ({
  page,
  playwright,
}) => {
  const email = uniqueEmail();
  // Its own client IP, past Better Auth's per-IP magic-link limit.
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const link = await readMagicLink(email);

  // A scanner fetches the link with a client of its own, without cookies,
  // and follows redirects.
  const scanner = await playwright.request.newContext({
    baseURL: new URL(link).origin,
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
  });
  const scanned = await scanner.get(link);
  expect(scanned.ok()).toBe(true);
  expect(await (await scanner.get("/api/auth/get-session")).json()).toBeNull();
  await scanner.dispose();

  await page.goto(link);
  await page.getByRole("button", { name: "Continue signing in" }).click();
  // Sign-in returns to /videos, which opens the window peeper video.
  await expect(page).toHaveURL("/videos/windowpeeper");
  expect((await getSession(page))?.user.email).toBe(email);
});

test("the sign-in page tags the method used last on this device", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to WindowPeeper" })).toBeVisible();
  await expect(page.getByText("Last used")).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("windowpeeper:last-sign-in", "google"));
  await page.reload();

  await expect(page.getByText("Last used")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
});

test("a spent link comes back to sign-in, which says so", async ({ page }) => {
  const email = uniqueEmail();
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(email);
  const link = await readMagicLink(email);

  await page.goto(link);
  await page.getByRole("button", { name: "Continue signing in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.context().clearCookies();
  await page.goto(link);
  await page.getByRole("button", { name: "Continue signing in" }).click();

  await expect(page).toHaveURL(/\/sign-in\?next=%2Fvideos&error=/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That sign-in link has expired or was already used. Send a new one.");
});
