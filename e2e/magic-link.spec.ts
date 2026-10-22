import { expect, test } from "@playwright/test";
import { getSession, randomIp, readMagicLink, uniqueEmail } from "./support/auth";

test("signs in with a magic link", async ({ page }) => {
  const email = uniqueEmail();
  // Its own client IP: other tests' page loads share the default one, and
  // Better Auth rate-limits per IP.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });

  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));
  await page.getByRole("button", { name: "Continue signing in" }).click();

  // Sign-in returns to /videos, which opens the window peeper video.
  await expect(page).toHaveURL("/en/videos/windowpeeper");
  expect((await getSession(page))?.user.email).toBe(email);
});

test("returns to the page that asked for sign-in", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/en/billing");
  await expect(page).toHaveURL("/en/sign-in?next=%2Fen%2Fbilling");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));
  await page.getByRole("button", { name: "Continue signing in" }).click();

  await expect(page).toHaveURL("/en/billing");
});

test("opening the link alone, as an email scanner does, signs nobody in and keeps the link usable", async ({
  page,
  playwright,
}) => {
  const email = uniqueEmail();
  // Its own client IP, past Better Auth's per-IP magic-link limit.
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
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
  await expect(page).toHaveURL("/en/videos/windowpeeper");
  expect((await getSession(page))?.user.email).toBe(email);
});
