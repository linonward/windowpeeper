import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { getSession, signIn } from "./support/auth";
import { addFailedVideos } from "./support/db";
import { greyPng } from "./support/images";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

test("signed-out visitors are redirected before the page renders", async ({ request }) => {
  const response = await request.get("/videos/windowpeeper", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/sign-in?next=%2Fvideos%2Fwindowpeeper");
});

test("/videos opens the window peeper video, the only photo effect", async ({ page, request }) => {
  // Before the session check, so old links and sign-in's default return land there.
  const response = await request.get("/videos", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/videos/windowpeeper");

  await signIn(page);
  await page.goto("/videos");

  await expect(page).toHaveURL("/videos/windowpeeper");
  await expect(page.getByRole("heading", { level: 1, name: "Make a window peeper video" })).toBeVisible();
  // New accounts start with no credits (signupCredits in src/server/credits/config.ts),
  // so the button buys credits.
  await expect(page.getByRole("complementary", { name: "Preview" }).getByRole("button", { name: "Buy credits" })).toBeVisible();
});

// The image-to-video generator is gone; only GET answers at /api/videos/<id>.
// Without a route, Next.js answers 404, or 400 to a multipart POST it takes
// for a Server Action; either way no video is made.
test("there is no generic generator route, and unknown videos are not found", async ({ page, request }) => {
  const multipart = {
    prompt: "The fox runs",
    duration: "5",
    resolution: "1080p",
    image: { name: "fox.png", mimeType: "image/png", buffer: png },
  };
  expect((await request.post("/api/videos", { data: {} })).status()).toBe(404);

  await signIn(page);
  const headers = { origin: BASE_URL };
  expect((await page.request.post("/api/videos", { data: {}, headers })).status()).toBe(404);
  const form = await page.request.post("/api/videos", { multipart, headers });
  // A multipart POST with no route reads as a Server Action Next.js can't
  // find: 409.
  expect([400, 404, 409]).toContain(form.status());
  expect(await form.text()).not.toContain("pending");

  const missing = await page.request.get("/api/videos/00000000-0000-0000-0000-000000000000");
  expect(missing.status()).toBe(404);
});

test("the library pages through every video from the sidebar and the generator", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  // VIDEOS_PAGE_SIZE in src/server/videos/config.ts, plus one.
  await addFailedVideos(user.id, 25);
  await page.goto("/videos/windowpeeper");

  await page.getByRole("link", { name: "All videos →" }).click();
  await expect(page).toHaveURL("/videos/library");
  await page.goto("/videos/windowpeeper");
  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: /My videos/ })
    .click();

  await expect(page).toHaveURL("/videos/library");
  await expect(page.getByRole("heading", { level: 1, name: "All videos" })).toBeVisible();
  const items = page.getByRole("list", { name: "All videos" }).getByRole("listitem");
  await expect(items).toHaveCount(24);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL("/videos/library?page=2");
  await expect(items).toHaveCount(1);

  await page.goto("/videos/library?page=3");
  await expect(page.getByRole("heading", { name: "This window is dark." })).toBeVisible();
});

test("a card opens the video's page, and unknown videos are not found", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  await addFailedVideos(user.id, 1);
  await page.goto("/videos/library");

  await page.getByRole("link", { name: "Seeded video 1" }).click();

  await expect(page).toHaveURL(/\/videos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Video details" })).toBeVisible();
  // Next.js keeps the library page in the DOM, hidden, for the back button.
  const visible = { visible: true };
  await expect(page.getByText("Generation failed. The credits were refunded.").filter(visible)).toBeVisible();
  await expect(page.getByText("Failed", { exact: true }).filter(visible)).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "All videos" }).filter(visible).click();
  await expect(page).toHaveURL("/videos/library");

  await page.goto("/videos/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "This window is dark." })).toBeVisible();
});

// CI has no storage, so only the refusals run here. The signed download URL
// is covered by src/server/videos/index.int.test.ts.
test("downloads need a session and a stored video of one's own", async ({ page, request }) => {
  const unknown = "/api/videos/00000000-0000-0000-0000-000000000000/download";
  expect((await request.get(unknown, { maxRedirects: 0 })).status()).toBe(401);

  await signIn(page);
  const { user } = await getSession(page);
  await addFailedVideos(user.id, 1);
  await page.goto("/videos/library");
  const href = await page.getByRole("link", { name: "Seeded video 1" }).getAttribute("href");

  for (const path of [unknown, `/api/videos/${href!.split("/").at(-1)}/download`]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "VIDEO_NOT_FOUND" });
  }
});

test("the sidebar opens the window peeper video, off while Bailian is not set up", async ({ page }) => {
  await signIn(page);
  await page.goto("/videos");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "New video", exact: true })
    .click();

  await expect(page).toHaveURL("/videos/windowpeeper");
  await expect(page.getByRole("heading", { level: 1, name: "Make a window peeper video" })).toBeVisible();
  await expect(page.getByText("The window peeper video isn't set up yet.")).toBeVisible();
});

// /api/videos/<kind> serves every photo effect; any other segment is no route.
test("the window peeper video's route answers at /api/videos/windowpeeper", async ({ page, request }) => {
  const headers = { origin: BASE_URL };
  expect((await request.post("/api/videos/windowpeeper", { multipart: {}, headers })).status()).toBe(401);

  await signIn(page);
  const missing = await page.request.post("/api/videos/windowpeeper", { multipart: { consent: "yes" }, headers });
  expect(missing.status()).toBe(400);
  expect(await missing.json()).toMatchObject({ error: "INVALID_REQUEST" });
  // Without consent=yes, nothing goes further.
  const unconsented = await page.request.post("/api/videos/windowpeeper", {
    multipart: { image1: { name: "a.png", mimeType: "image/png", buffer: greyPng(320, 320) } },
    headers,
  });
  expect(unconsented.status()).toBe(400);
  expect(await unconsented.json()).toMatchObject({ error: "INVALID_REQUEST" });
  const off = await page.request.post("/api/videos/windowpeeper", {
    multipart: { image1: { name: "a.png", mimeType: "image/png", buffer: greyPng(320, 320) }, consent: "yes" },
    headers,
  });
  expect(off.status()).toBe(503);
  expect(await off.json()).toMatchObject({ error: "VIDEOS_DISABLED" });
  // The retired effects and the rap duo are gone.
  for (const kind of ["not-an-effect", "zombie", "rap", "effects"]) {
    const unknown = await page.request.post(`/api/videos/${kind}`, { multipart: {}, headers });
    expect(unknown.status(), kind).toBe(404);
  }
});

// The window peeper video sells standard and Pro.
test("a photo effect's quality is standard or pro", async ({ page }) => {
  await signIn(page);
  const post = (kind: string, quality: string) =>
    page.request.post(`/api/videos/${kind}`, {
      multipart: { image1: { name: "a.png", mimeType: "image/png", buffer: greyPng(320, 320) }, quality, consent: "yes" },
      headers: { origin: BASE_URL },
    });

  for (const [kind, quality, status, error] of [
    ["windowpeeper", "hd", 400, "INVALID_REQUEST"],
    // Valid, then off: E2E has no Bailian.
    ["windowpeeper", "pro", 503, "VIDEOS_DISABLED"],
    ["windowpeeper", "standard", 503, "VIDEOS_DISABLED"],
  ] as const) {
    const response = await post(kind, quality);
    expect(response.status(), `${kind} ${quality}`).toBe(status);
    expect(await response.json()).toMatchObject({ error });
  }
});

test("a photo too small for Bailian is turned away as soon as it is picked", async ({ page }) => {
  await signIn(page);
  await page.goto("/videos/windowpeeper");
  const photo = page.locator("#new-photo-input");
  const preview = page.getByRole("img", { name: "Your photo preview" });
  // A pick before hydration has no handler yet, so repeat it until the preview shows.
  await expect(async () => {
    await photo.setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: greyPng(320, 320) });
    await expect(preview).toBeVisible({ timeout: 1000 });
  }).toPass();

  await photo.setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: greyPng(194, 259) });

  await expect(
    page.getByRole("alert").filter({
      hasText: "Use a photo 240 to 8,000 pixels on each side, with the long side at most 8 times the short side.",
    }),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
});
