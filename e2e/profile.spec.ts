import { expect, test } from "@playwright/test";
import { getSession, signIn } from "./support/auth";

test("sends signed-out visitors to /sign-in", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL("/sign-in?next=%2Fprofile");
});

test("redirects on the server before any JavaScript runs", async ({
  request,
}) => {
  const response = await request.get("/profile", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/sign-in?next=%2Fprofile");
});

test("rejects a forged session cookie on the server", async ({
  page,
  context,
  baseURL,
}) => {
  // Passes the cookie-only check in src/proxy.ts; the (app) layout must
  // still reject it.
  await context.addCookies([
    { name: "better-auth.session_token", value: "forged", url: baseURL! },
  ]);

  await page.goto("/profile");

  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("status", { name: "Loading…" })).toBeHidden();
});

test("shows the signed-in user's details", async ({ page }) => {
  const email = await signIn(page);

  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  // The sidebar shows the email too; check the profile itself.
  await expect(page.getByRole("main").getByText(email)).toBeVisible();
});

test("leaves the balance and sign-out to the account menu", async ({ page }) => {
  await signIn(page);

  await page.goto("/profile");

  const main = page.getByRole("main");
  await expect(main.getByRole("term")).toHaveText(["Name", "Email", "Email verified", "Member since"]);
  await expect(main.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("deletes the account after confirming in a dialog", async ({ page }) => {
  await signIn(page);
  await page.goto("/profile");

  await page.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL("/");
  expect(await getSession(page)).toBeNull();
});

test("Escape closes the delete dialog without deleting", async ({ page }) => {
  const email = await signIn(page);
  await page.goto("/profile");

  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("alertdialog")).toBeHidden();
  expect((await getSession(page))?.user.email).toBe(email);
});
