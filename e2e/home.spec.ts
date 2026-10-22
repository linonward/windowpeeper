import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test("hero states the value, with the generator starting in the first screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Window Peeper AI Video – Make the TikTok Trend From a Photo");
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    "Make the window peeper trend video from one photo: caught mid-bite in a lit window, a long stare, then the curtain. Six scenes, no CapCut template.",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Window peeper AI video — Someone's watching you eat.",
    }),
  ).toBeVisible();
  // The photo zone shows under the headline in the first screen.
  await expect(page.getByRole("region", { name: "Make your window peeper video" }).getByText("Drop a photo or click to choose")).toBeInViewport();
});

test("the hero plays the example clip, served from public/", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.getByText("A real video made here. The person in it is AI-generated.")).toBeVisible();
  const video = page.locator("main video").first();
  await expect(video).toBeVisible();
  const response = await request.get((await video.getAttribute("src")) as string);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("video/mp4");
});

test("on a phone, the photo zone shows in the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("region", { name: "Make your window peeper video" }).getByText("Drop a photo or click to choose")).toBeInViewport();
});

test("the header offers sign-in to visitors and the dashboard once signed in", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/sign-in");

  await signIn(page);
  await page.goto("/pricing");
  await expect(banner.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL("/videos/windowpeeper");
});

test("landing has the scenes, steps, pricing, shot list, FAQ and a closing call to action back to the generator", async ({
  page,
}) => {
  await page.goto("/");

  for (const name of [
    "Pick your window",
    "How to do the window peeper trend",
    "Start with one video.",
    "14 seconds, five beats",
    "Window peeper AI video questions",
    "Your window is open.",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await page.getByRole("region", { name: "Your window is open." }).getByRole("link", { name: "Make my video" }).click();
  await expect(page).toHaveURL("/#generator");
  await expect(page.getByRole("region", { name: "Make your window peeper video" }).getByText("Drop a photo or click to choose")).toBeInViewport();
});

test("the header's links scroll to the home page's sections", async ({ page }) => {
  await page.goto("/blog");
  const banner = page.getByRole("banner");

  for (const [link, heading] of [
    ["Scenes", "Pick your window"],
    ["How it works", "How to do the window peeper trend"],
  ]) {
    await banner.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeInViewport();
  }
});

test("FAQ answers open on click", async ({ page }) => {
  await page.goto("/");

  await page.getByText("What if my video fails?").click();

  await expect(page.getByText("The credits come back to your balance automatically")).toBeVisible();
});

test("\"Use this scene\" picks the scene in the generator and scrolls up to it", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Use the Couple dinner scene" }).click();

  await expect(page).toHaveURL("/#generator");
  await expect(page.getByRole("radio", { name: "Couple" })).toBeChecked();
});

test("on a phone, a bar leads back to the generator once it scrolls away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const bar = page.getByText("Your window video");
  await expect(bar).toBeHidden();

  await page.getByRole("heading", { level: 2, name: "How to do the window peeper trend" }).scrollIntoViewIfNeeded();

  await expect(bar).toBeVisible();
});

test("landing is translated", async ({ page }) => {
  await page.goto("/es");

  await expect(
    page.getByRole("heading", { level: 1, name: /^Video de window peeper con IA — / }),
  ).toBeVisible();
});

test("keyboard users can skip to the main content", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");

  await expect(page).toHaveURL("/#main-content");
});

for (const width of [320, 375]) {
  for (const locale of ["en", "es", "de"]) {
    test(`fits a ${width}px phone in ${locale} without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(`/${locale}`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("turns off icon motion for reduced motion", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("summary svg.lucide-plus").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.close();
});

test("body uses the Instrument Sans font", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toHaveCSS("font-family", /Instrument Sans/);
});
