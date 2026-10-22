import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/auth";

// E2E builds without Bailian (playwright.config.ts), so the window peeper video is
// off: the home generator says so and stays inert. Its flow (consent, sign-in
// in a dialog, sending on return, progress, the player, download and share)
// is covered by src/components/home/window-peeper-tryout.test.tsx, as is paying
// from it (payments are off here too).
async function expectInert(page: Page) {
  const generator = page.getByRole("region", { name: "Make your window peeper video" });
  await expect(generator).toContainText("The window peeper video isn't set up yet.");
  await expect(generator.getByLabel("Add your photo", { exact: true }).and(generator.locator("input"))).toBeDisabled();
  await expect(generator.getByRole("button", { name: "Make my video" })).toBeDisabled();
}

test("a visitor finds the generator on the home page, off until it is set up", async ({ page }) => {
  await page.goto("/");

  await expectInert(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a signed-in visitor gets the same generator on the home page", async ({ page }) => {
  await signIn(page);
  await page.goto("/");

  await expect(page.getByRole("banner").getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expectInert(page);
});

test("back from checkout, the page drops the checkout from its address and sends nothing", async ({ page }) => {
  await signIn(page);
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/")) sent.push(request.url());
  });

  for (const checkout of ["success", "cancel"]) {
    await page.goto(`/?checkout=${checkout}&try=1#generator`);
    await expect(page).toHaveURL(/\/#generator$/);
    await expectInert(page);
  }
  expect(sent).toEqual([]);
});

test("the generator is translated", async ({ page }) => {
  await page.goto("/es");

  const generator = page.locator("#generator");
  await expect(generator).toContainText("El video de window peeper todavía no está configurado.");
});
