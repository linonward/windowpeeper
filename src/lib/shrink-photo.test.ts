import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fitWithin, SHRINK_MAX_SIDE, shrinkPhoto } from "./shrink-photo";

const MB = 1024 * 1024;
const LIMIT = 4 * MB;

const photo = (bytes: number, name = "me.png", type = "image/png") =>
  new File([new Uint8Array(bytes)], name, { type });

// A decoded image of the given size, as createImageBitmap returns it.
const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() });

// An OffscreenCanvas whose JPEG is `bytes` long, recording what it drew.
function canvasOf(bytes: number, type = "image/jpeg") {
  const drawn: { width: number; height: number }[] = [];
  const encoded: { type?: string; quality?: number }[] = [];
  class FakeCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return {
        fillRect: vi.fn(),
        drawImage: (_: unknown, _x: number, _y: number, width: number, height: number) => drawn.push({ width, height }),
      };
    }
    async convertToBlob(options: { type?: string; quality?: number }) {
      encoded.push(options);
      return new Blob([new Uint8Array(bytes)], { type });
    }
  }
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  return { drawn, encoded };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test.each([
  [4000, 3000, 2048, { width: 2048, height: 1536 }],
  [3000, 4000, 2048, { width: 1536, height: 2048 }],
  [6000, 1000, 2048, { width: 2048, height: 341 }],
  [2048, 2048, 2048, { width: 2048, height: 2048 }],
  // Never upscales.
  [800, 600, 2048, { width: 800, height: 600 }],
])("fitWithin(%i, %i, %i) is %o", (width, height, maxSide, size) => {
  expect(fitWithin(width, height, maxSide)).toEqual(size);
});

test("a large photo comes back as a JPEG with its long side at 2048 pixels, read the right way up", async () => {
  const decode = vi.fn(async () => bitmap(4032, 3024));
  vi.stubGlobal("createImageBitmap", decode);
  const { drawn, encoded } = canvasOf(900_000);

  const result = await shrinkPhoto(photo(4.6 * MB, "IMG_0042.HEIC.png"), LIMIT);

  expect(decode).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
  expect(SHRINK_MAX_SIDE).toBe(2048);
  expect(drawn).toEqual([{ width: 2048, height: 1536 }]);
  expect(encoded).toEqual([{ type: "image/jpeg", quality: 0.9 }]);
  expect(result).toBeInstanceOf(File);
  expect(result.type).toBe("image/jpeg");
  expect(result.name).toBe("IMG_0042.HEIC.jpg");
  expect(result.size).toBe(900_000);
});

test("a photo over the upload limit is made a JPEG even when it is small enough in pixels", async () => {
  vi.stubGlobal("createImageBitmap", async () => bitmap(1800, 1200));
  const { drawn } = canvasOf(700_000);

  const result = await shrinkPhoto(photo(4.5 * MB, "me"), LIMIT);

  expect(drawn).toEqual([{ width: 1800, height: 1200 }]);
  expect(result.name).toBe("me.jpg");
  expect(result.size).toBe(700_000);
});

test("a photo within the pixel and upload limits is kept as it is", async () => {
  vi.stubGlobal("createImageBitmap", async () => bitmap(1600, 1200));
  const { drawn } = canvasOf(100);
  const file = photo(1.5 * MB);

  expect(await shrinkPhoto(file, LIMIT)).toBe(file);
  expect(drawn).toEqual([]);
});

test("keeps the original when the browser can't decode the photo", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      throw new DOMException("bad image", "InvalidStateError");
    }),
  );
  canvasOf(100);
  const file = photo(4.5 * MB);

  // jsdom's <img> can't decode either, so both ways fail.
  expect(await shrinkPhoto(file, LIMIT)).toBe(file);
});

test("keeps the original without createImageBitmap or a canvas", async () => {
  const file = photo(4.5 * MB);

  expect(await shrinkPhoto(file, LIMIT)).toBe(file);
});

test("keeps the original when the JPEG isn't smaller, or isn't a JPEG", async () => {
  vi.stubGlobal("createImageBitmap", async () => bitmap(4000, 3000));
  const file = photo(3 * MB);

  canvasOf(3 * MB + 1);
  expect(await shrinkPhoto(file, LIMIT)).toBe(file);

  // A browser that can't write JPEG writes PNG instead.
  canvasOf(100, "image/png");
  expect(await shrinkPhoto(file, LIMIT)).toBe(file);
});

test("keeps the original when encoding fails", async () => {
  vi.stubGlobal("createImageBitmap", async () => bitmap(4000, 3000));
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      getContext() {
        return null;
      }
    },
  );
  const file = photo(3 * MB);

  // jsdom's <canvas> has no 2D context either.
  expect(await shrinkPhoto(file, LIMIT)).toBe(file);
});
