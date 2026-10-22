import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const shrinkPhoto = vi.fn();
const fitsImageLimits = vi.fn();
vi.mock("@/lib/shrink-photo", () => ({ shrinkPhoto }));
vi.mock("@/lib/image-limits", () => ({ fitsImageLimits }));

const { usePhotoPicks } = await import("./use-photo-picks");

const MB = 1024 * 1024;
const limits = { minSide: 240, maxSide: 8000, maxRatio: 8 };
const photo = (bytes: number, name = "me.png") => new File([new Uint8Array(bytes)], name, { type: "image/png" });

function setup() {
  const onError = vi.fn();
  const hook = renderHook(() =>
    usePhotoPicks({ maxPickBytes: 5 * MB, maxUploadBytes: 4 * MB, imageLimits: limits, onError }),
  );
  return { onError, hook };
}

beforeEach(() => {
  let next = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${++next}`);
  URL.revokeObjectURL = vi.fn();
  fitsImageLimits.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

test("a 5 MB pick is shrunk, and the smaller file is the one kept and previewed", async () => {
  const { hook, onError } = setup();
  const picked = photo(5 * MB);
  const small = photo(800_000, "me.jpg");
  shrinkPhoto.mockResolvedValue(small);

  act(() => hook.result.current.pick("left", picked));

  expect(shrinkPhoto).toHaveBeenCalledWith(picked, 4 * MB);
  await waitFor(() => expect(hook.result.current.photos.left).toBe(small));
  expect(hook.result.current.previews.left).toBe("blob:preview-1");
  expect(URL.createObjectURL).toHaveBeenCalledWith(small);
  // The pixel limits are checked on the file that is sent.
  expect(fitsImageLimits).toHaveBeenCalledWith(small, limits);
  expect(onError).toHaveBeenLastCalledWith(null);
});

test("a pick over 5 MB is refused at once", () => {
  const { hook, onError } = setup();

  act(() => hook.result.current.pick("left", photo(5 * MB + 1)));

  expect(onError).toHaveBeenLastCalledWith("invalid");
  expect(shrinkPhoto).not.toHaveBeenCalled();
  expect(hook.result.current.photos.left).toBeNull();
  expect(hook.result.current.previews.left).toBeNull();
});

test("a photo still over 4 MB after shrinking is dropped", async () => {
  const { hook, onError } = setup();
  const picked = photo(4.5 * MB);
  // The browser couldn't shrink it.
  shrinkPhoto.mockResolvedValue(picked);

  act(() => hook.result.current.pick("left", picked));

  await waitFor(() => expect(onError).toHaveBeenLastCalledWith("tooLarge"));
  expect(hook.result.current.photos.left).toBeNull();
  expect(hook.result.current.previews.left).toBeNull();
  expect(fitsImageLimits).not.toHaveBeenCalled();
});

test("a shrunk photo outside the pixel limits is dropped", async () => {
  const { hook, onError } = setup();
  shrinkPhoto.mockImplementation(async (file: File) => file);
  fitsImageLimits.mockResolvedValue(false);

  act(() => hook.result.current.pick("left", photo(1000)));

  await waitFor(() => expect(onError).toHaveBeenLastCalledWith("imageSize"));
  expect(hook.result.current.photos.left).toBeNull();
});

test("the latest pick wins over a slower earlier one", async () => {
  const { hook } = setup();
  const first = photo(4.8 * MB, "first.png");
  const second = photo(1000, "second.png");
  let finishFirst: (file: File) => void = () => {};
  shrinkPhoto
    .mockImplementationOnce(() => new Promise<File>((resolve) => (finishFirst = resolve)))
    .mockImplementationOnce(async (file: File) => file);

  act(() => hook.result.current.pick("left", first));
  act(() => hook.result.current.pick("left", second));
  await waitFor(() => expect(hook.result.current.photos.left).toBe(second));
  await act(async () => finishFirst(photo(500_000, "first.jpg")));

  expect(hook.result.current.photos.left).toBe(second);
});

test("clearing a pick empties the side", async () => {
  const { hook } = setup();
  shrinkPhoto.mockImplementation(async (file: File) => file);
  act(() => hook.result.current.pick("left", photo(1000)));
  await waitFor(() => expect(hook.result.current.photos.left).not.toBeNull());

  act(() => hook.result.current.pick("left", null));

  expect(hook.result.current.photos.left).toBeNull();
  expect(hook.result.current.previews.left).toBeNull();
});
