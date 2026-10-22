import { expect, test } from "@playwright/test";

test("a missing page says so, and offers the generator and the scenes", async ({ page }) => {
  const response = await page.goto("/no-such-page");

  expect(response?.status()).toBe(404);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "This window is dark." })).toBeVisible();
  await expect(main.getByRole("link", { name: "Make a video" })).toHaveAttribute("href", "/#generator");
  await expect(main.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  await expect(main.getByRole("link", { name: /^Use the .* scene$/ })).toHaveCount(4);

  await main.getByRole("link", { name: "Use the Midnight noodles scene" }).click();

  await expect(page).toHaveURL("/?scene=noodles#generator");
  await expect(page.getByRole("radio", { name: "Noodles" })).toBeChecked();
});

test("on phones the title and the buttons come first", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/no-such-page");

  await expect(page.getByRole("main").getByRole("figure")).toBeHidden();
  await expect(page.getByRole("main").getByRole("link", { name: "Make a video" })).toBeInViewport();
});
