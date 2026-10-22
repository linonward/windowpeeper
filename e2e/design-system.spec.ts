import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/auth";

// One visual system across pages (docs/DESIGN.md): dark only, lamp primary,
// 10px radius on buttons and inputs, Big Shoulders headings, Lucide icons at
// 1.75 stroke.

// The browser may serialize colors as oklch() or lab(); compare against
// what it computes for the primary token instead of a literal.
async function primaryColor(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--primary)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
}

test("sign-in uses the shared visual system", async ({ page }) => {
  await page.goto("/en/sign-in");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-family",
    /Big Shoulders/,
  );
  const submit = page.getByRole("button", { name: "Send magic link" });
  await expect(submit).toHaveCSS("border-top-left-radius", "10px");
  await expect(submit).toHaveCSS("background-color", await primaryColor(page));
  await expect(submit.locator("svg.lucide").first()).toHaveCSS("stroke-width", "1.75px");
  await expect(page.getByLabel("Email")).toHaveCSS("border-top-left-radius", "10px");
});

test("profile uses the shared visual system", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/profile");

  // Dashboard titles are Big Shoulders 800 (docs/DESIGN.md, Dashboard).
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveCSS("font-family", /Big Shoulders/);
  await expect(title).toHaveCSS("font-weight", "800");
  await expect(page.getByText("Your account details.")).toBeVisible();
  const remove = page.getByRole("main").getByRole("button", { name: "Delete account" });
  await expect(remove).toHaveCSS("border-top-left-radius", "10px");
  await expect(remove.locator("svg.lucide")).toBeVisible();
});

test("the site is dark only, whatever the system's theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/en");

  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(9, 12, 19)");
  await expect(page.getByRole("group", { name: "Theme" })).toHaveCount(0);
});

test("landing uses Lucide icons and a lamp primary action", async ({ page }) => {
  await page.goto("/en");

  const cta = page.getByRole("region", { name: "Your window is open." }).getByRole("link", { name: "Make my video" });
  await expect(cta).toHaveCSS("background-color", await primaryColor(page));
  await expect(cta.locator("svg.lucide-arrow-right")).toBeVisible();
});

test("FAQ plus icon turns into a close mark when open", async ({ page }) => {
  await page.goto("/en");

  const item = page.locator("details").filter({ hasText: "What if my video fails?" });
  const icon = item.locator("summary svg.lucide-plus");
  await expect(icon).toHaveCSS("transform", "none");
  await item.locator("summary").click();
  await expect(icon).not.toHaveCSS("transform", "none");
});

for (const width of [320, 375]) {
  for (const path of ["/en/sign-in", "/es/sign-in"]) {
    test(`${path} fits ${width}px without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("profile fits 320px without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await signIn(page);
  await page.goto("/es/profile");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
