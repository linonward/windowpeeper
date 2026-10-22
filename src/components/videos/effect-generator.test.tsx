import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { EffectGenerator, type EffectGeneratorProps } from "./effect-generator";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

const props: EffectGeneratorProps = {
  kind: "windowpeeper",
  balance: 100,
  credits: 10,
  maxPickBytes: 5 * 1024 * 1024,
  maxUploadBytes: 4 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
  enabled: true,
  videos: [],
};

const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });
const pending = {
  id: "new",
  prompt: "Window peeper",
  duration: 9,
  resolution: "720p",
  credits: 10,
  status: "pending",
  createdAt: "2026-10-15T00:00:00.000Z",
  url: null,
  imageUrl: "https://storage.test/new.jpg",
};

// jsdom can't decode images, so the photo is kept as picked; the form takes
// it once the (async) shrink step is done.
async function pick(label: string) {
  const file = new File([new Uint8Array(10)], `${label}.jpg`, { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  await screen.findByRole("img", { name: `${label} preview` });
  return file;
}

// The consent box, which the server requires (consent=yes).
const agree = () => fireEvent.click(screen.getByRole("checkbox"));

test("needs the photo and the consent box before it generates", async () => {
  renderWithIntl(<EffectGenerator {...props} />);
  const button = screen.getByRole("button", { name: "Generate (10 credits)" });

  await pick("Your photo");
  expect(button.hasAttribute("disabled")).toBe(true);
  agree();
  expect(button.hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("img", { name: "Your photo preview" }).getAttribute("src")).toBe("blob:preview");
});

test("sends the photo as image1 to its own route, then polls until the video is ready", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(
      reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/new.mp4" } }),
    );
  renderWithIntl(<EffectGenerator {...props} />);

  expect(screen.getByRole("heading", { level: 2, name: "Your videos" })).toBeTruthy();
  const photo = await pick("Your photo");
  agree();
  fireEvent.click(screen.getByRole("button", { name: "Generate (10 credits)" }));

  await waitFor(() => expect(screen.getByText("90 credits left")).toBeTruthy());
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/windowpeeper");
  const form = init.body as FormData;
  expect(form.get("image1")).toBe(photo);
  expect(form.has("image2")).toBe(false);
  expect(form.get("consent")).toBe("yes");

  await vi.advanceTimersByTimeAsync(5000);
  const history = screen.getByRole("list", { name: "Your videos" });
  await waitFor(() => expect(within(history).getByLabelText(pending.prompt).tagName).toBe("VIDEO"));
});

test("the consent box speaks of one photo", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  expect(
    screen.getByRole("checkbox", { name: "I confirm this is my photo, or I have permission from the adult in it." }),
  ).toBeTruthy();
});

test("states the 5 MB pick limit and refuses a photo over it", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  expect(screen.getByText(/^JPEG, PNG or WebP, up to 5 MB\./)).toBeTruthy();
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [big] } });

  expect(screen.getByRole("alert").textContent).toBe("Use a JPEG, PNG or WebP photo up to 5 MB.");
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();
});

// jsdom can't decode, so a photo over the 4 MB upload limit can't shrink.
test("refuses a photo still over the upload limit after shrinking", async () => {
  renderWithIntl(<EffectGenerator {...props} />);

  const big = new File([new Uint8Array(4.5 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [big] } });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "This photo is too large to upload, even made smaller. Try another photo.",
  );
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();
});

test.each([
  [402, "INSUFFICIENT_CREDITS", "Not enough credits"],
  [422, "CONTENT_BLOCKED", "The photo was blocked by content moderation. Try a different one."],
  [400, "INVALID_IMAGE_SIZE", "Use a photo 240 to 8,000 pixels on each side"],
  [503, "VIDEOS_DISABLED", "isn't set up yet"],
])("explains a %s reply", async (status, error, text) => {
  fetchMock.mockResolvedValueOnce(reply(status, { error }));
  renderWithIntl(<EffectGenerator {...props} />);

  await pick("Your photo");
  agree();
  fireEvent.click(screen.getByRole("button", { name: "Generate (10 credits)" }));

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(text));
  expect(screen.getByText("100 credits left")).toBeTruthy();
});

test("links to billing when the balance is short, and says when it is off", () => {
  renderWithIntl(<EffectGenerator {...props} balance={5} enabled={false} />);

  expect(screen.getByText("The window peeper video isn't set up yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Buy credits" }).getAttribute("href")).toBe("/en/billing");
});
