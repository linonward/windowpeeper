import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { addPurchase } from "./support/db";

// The credit history moved into /billing (next.config.ts redirects).
test("the old credits page redirects to billing", async ({ request }) => {
  const response = await request.get("/credits", { maxRedirects: 0 });

  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/billing");
});

test("the credit history fits a phone in Chinese", async ({ page }) => {
  const email = await signIn(page);
  await addPurchase(email, 10);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/es/credits");

  await expect(page).toHaveURL("/es/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Créditos y facturación" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Historial de créditos" })).toContainText("Paquete");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
