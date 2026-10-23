import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test("hero states the value, with the generator starting in the first screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Window Peeper AI Video Generator – Make the TikTok Trend From a Photo");
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    "Make the window peeper trend video from one photo: caught mid-bite in a lit window, a long stare, then the curtain. Six scenes, no CapCut template.",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Window peeper AI video generator — Someone's watching you eat.",
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

test("on a phone, the example clip plays under the generator, inside the screen width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const generator = page.getByRole("region", { name: "Make your window peeper video" });
  const video = page.locator("main video").first();
  await video.scrollIntoViewIfNeeded();
  await expect(video).toBeVisible();
  await expect(page.getByText("A real video made here. The person in it is AI-generated.")).toBeVisible();
  const [form, clip] = [await generator.boundingBox(), await video.boundingBox()];
  expect(clip!.y).toBeGreaterThan(form!.y + form!.height);
  expect(clip!.x).toBeGreaterThanOrEqual(0);
  expect(clip!.x + clip!.width).toBeLessThanOrEqual(390);
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
    page.getByRole("heading", { level: 1, name: /^Generador de videos de window peeper con IA — / }),
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

test("the REC dot blinks, but not for reduced motion", async ({ browser }) => {
  for (const [reducedMotion, name] of [["no-preference", "rec-blink"], ["reduce", "none"]] as const) {
    const page = await browser.newPage({ reducedMotion });
    await page.goto("/");
    await expect(page.locator(".bg-rec").first(), reducedMotion).toHaveCSS("animation-name", name);
    await page.close();
  }
});

test("the home page's timecodes read 01:28", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  // The hero's timecode counts up from 01:28:00.
  await expect(page.getByText(/^REC 01:28:\d\d AM$/)).toBeVisible();
  await expect(page.getByText("REC 01:28:00 AM · CAM 03", { exact: true })).toBeVisible();
  await expect(page.getByText("02:14")).toHaveCount(0);
});

test("body uses the Instrument Sans font", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toHaveCSS("font-family", /Instrument Sans/);
});

// docs/DESIGN.md, Motion: four one-shot motions on the home page, each off
// for reduced motion, where every element shows its end state at once.
test("the hero's camera finds focus on load, and its timecode counts up", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const viewfinder = page.locator("figure.focus-in").first();
  await expect(viewfinder.locator("img")).toHaveCSS("animation-name", "focus-in");
  await expect(viewfinder.locator(".corner").first()).toHaveCSS("animation-name", "corner-in");
  await expect(viewfinder.getByText(/^REC 01:28:0[1-9] AM$/)).toBeVisible({ timeout: 5000 });
});

test("the scene windows light up one by one once the grid is in view", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const last = page.locator("#scenes .window-dark").last();
  const text = page.locator("#scenes .window-text").last();
  await expect(last).toHaveCSS("opacity", "0.8");
  await expect(text).toHaveCSS("opacity", "0");
  await page.locator("#scenes ul").scrollIntoViewIfNeeded();
  await expect(last).toHaveCSS("opacity", "0", { timeout: 5000 });
  await expect(text).toHaveCSS("opacity", "1", { timeout: 5000 });
});

test("the shot list's playhead runs and lights every beat once in view", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const playhead = page.locator(".playhead");
  const lastTime = page.locator(".beat-time").last();
  await expect(playhead).toHaveCSS("scale", "0 1");
  await expect(lastTime).toHaveCSS("color", "rgb(100, 108, 128)");
  await playhead.scrollIntoViewIfNeeded();
  await expect(playhead).toHaveCSS("scale", "none", { timeout: 8000 });
  await expect(lastTime).toHaveCSS("color", "rgb(255, 200, 119)", { timeout: 8000 });
});

test("the sections below the hero settle as they scroll in", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const title = page.locator("#how-it-works-title");
  await expect(title).toHaveCSS("opacity", "0");
  await title.scrollIntoViewIfNeeded();
  await expect(title).toHaveCSS("opacity", "1", { timeout: 5000 });
});

test("reduced motion shows every motion's end state at once", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  await page.goto("/");

  await expect(page.locator("figure.focus-in img").first()).toHaveCSS("animation-name", "none");
  await expect(page.locator("#scenes .window-dark").last()).toHaveCSS("opacity", "0");
  await expect(page.locator(".playhead")).toHaveCSS("scale", "none");
  await expect(page.locator(".beat-time").last()).toHaveCSS("color", "rgb(255, 200, 119)");
  await expect(page.locator("#how-it-works-title")).toHaveCSS("opacity", "1");
  await page.waitForTimeout(1500);
  await expect(page.getByText("REC 01:28:00 AM", { exact: true })).toBeVisible();
  await page.close();
});
