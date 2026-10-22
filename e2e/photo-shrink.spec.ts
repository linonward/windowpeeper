import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { greyPng, noisyPng } from "./support/images";

// Chromium shrinks a heavy photo before it uploads (src/lib/shrink-photo.ts),
// so the body stays under Vercel's 4.5 MB limit. E2E builds without Bailian,
// so no form here can send: the home generator is inert. The dashboard form
// still takes picks through the same usePhotoPicks, and its preview is the
// file it would send, so these read that file back.
const MB = 1024 * 1024;

async function pickPhoto(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await signIn(page);
  await page.goto("/videos/windowpeeper");
  const photo = page.locator("#new-photo-input");
  const preview = page.getByRole("img", { name: "Your photo preview" });
  // A pick before hydration has no handler yet, so repeat a light one until
  // the preview shows.
  await expect(async () => {
    await photo.setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: greyPng(320, 320) });
    await expect(preview).toBeVisible({ timeout: 1000 });
  }).toPass();
  const before = await preview.getAttribute("src");

  await photo.setInputFiles(file);

  await expect(preview).not.toHaveAttribute("src", before ?? "");
  await expect(preview).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  return preview.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const blob = await (await fetch(image.src)).blob();
    return { bytes: blob.size, type: blob.type, width: image.naturalWidth, height: image.naturalHeight };
  });
}

test("a photo between 4 and 5 MB is shrunk to a JPEG under 4 MB, 2048 pixels on its long side", async ({ page }) => {
  const heavy = noisyPng(3000, 2000, 1500);
  expect(heavy.length).toBeGreaterThan(4 * MB);
  expect(heavy.length).toBeLessThan(5 * MB);

  const sent = await pickPhoto(page, { name: "heavy.png", mimeType: "image/png", buffer: heavy });

  expect(sent.type).toBe("image/jpeg");
  expect(sent.bytes).toBeLessThan(4 * MB);
  expect({ width: sent.width, height: sent.height }).toEqual({ width: 2048, height: 1365 });
});

// EXIF orientation 6: the camera was turned, so the pixels are stored
// 2400×1200 and show 1200×2400.
test("a turned phone photo is shrunk the right way up", async ({ page }) => {
  await page.goto("about:blank");
  const jpeg = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(2400, 1200);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#c33";
    context.fillRect(0, 0, 2400, 1200);
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg" })).arrayBuffer());
    // APP1: "Exif", a big-endian TIFF header and one IFD entry, Orientation (0x0112) = 6.
    // prettier-ignore
    const exif = [
      0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
      0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ];
    return [...bytes.subarray(0, 2), ...exif, ...bytes.subarray(2)];
  });

  const sent = await pickPhoto(page, { name: "turned.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });

  expect({ width: sent.width, height: sent.height }).toEqual({ width: 1024, height: 2048 });
});
