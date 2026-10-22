import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { EffectGenerator, type EffectGeneratorProps } from "./effect-generator";

const fetchMock = vi.fn();
const openBuy = vi.fn();
vi.mock("@/components/billing/buy-credits", () => ({ useBuyCredits: () => ({ open: openBuy }) }));
// src/lib/analytics.test.ts covers sending; this checks which steps fire.
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track }));

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
  openBuy.mockReset();
  track.mockReset();
});

const props: EffectGeneratorProps = {
  kind: "windowpeeper",
  balance: 100,
  credits: 10,
  proCredits: 20,
  maxPickBytes: 10 * 1024 * 1024,
  maxUploadBytes: 4 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
  enabled: true,
  videos: [],
};

const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });
const pending = {
  id: "new",
  prompt: "Window peeper",
  duration: 14,
  resolution: "720p",
  ratio: "9:16",
  preview: false,
  scene: "noodles",
  credits: 10,
  status: "pending",
  createdAt: "2026-10-15T00:00:00.000Z",
  url: null,
  imageUrl: "https://storage.test/new.jpg",
  posterUrl: null,
};

// jsdom can't decode images, so the photo is kept as picked; the form takes
// it once the (async) shrink step is done.
async function pick() {
  const file = new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo", { selector: "input" }), { target: { files: [file] } });
  await screen.findByRole("img", { name: "Your photo preview" });
  return file;
}

// The consent box, which the server requires (consent=yes).
const agree = () =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: "I confirm this is a photo of me and I am 18 or older." }),
  );
const submit = (name = "Make my video · 10 credits") => screen.getByRole("button", { name });

test("needs the photo and the consent box before it makes a video", async () => {
  renderWithIntl(<EffectGenerator {...props} />);

  await pick();
  expect(submit().hasAttribute("disabled")).toBe(true);
  agree();
  expect(submit().hasAttribute("disabled")).toBe(false);
  expect(screen.getByText("me.jpg")).toBeTruthy();
});

test("offers the six windows, the original first and picked", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  const scenes = within(screen.getByRole("radiogroup", { name: "Pick a window" })).getAllByRole("radio");
  expect(scenes.map((radio) => (radio as HTMLInputElement).value)).toEqual([
    "burger",
    "noodles",
    "pizza",
    "wave",
    "glass",
    "couple",
  ]);
  expect((scenes[0] as HTMLInputElement).checked).toBe(true);
});

// One place for what's left to do: the consent box, the quality and the button.
test("keeps the consent box, the quality and the button together", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  const action = screen.getByRole("region", { name: "Your video" });
  expect(within(action).getByRole("checkbox")).toBeTruthy();
  expect(within(action).getByRole("radiogroup", { name: "Quality" })).toBeTruthy();
  expect(within(action).getByRole("button", { name: "Make my video · 10 credits" })).toBeTruthy();
});

test("Pro changes the price on the button and the wait in the note", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  expect(screen.getByText(/^Ready in about 3 min\./)).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Pro 1080p" }));

  expect(submit("Make my video · 20 credits")).toBeTruthy();
  expect(screen.getByText("Sharper face. Ready in about 6 min. If the video fails, the 20 credits come back.")).toBeTruthy();
});

test("sends the photo, scene, quality and a vertical frame, then polls until the video is ready", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/new.mp4" } }));
  renderWithIntl(<EffectGenerator {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("radio", { name: /Midnight noodles/ }));
  agree();
  fireEvent.click(submit());

  await screen.findByText("1 video rendering");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/windowpeeper");
  const form = init.body as FormData;
  expect(form.get("image1")).toBe(photo);
  expect(form.get("scene")).toBe("noodles");
  expect(form.get("quality")).toBe("standard");
  expect(form.get("ratio")).toBe("9:16");
  expect(form.get("consent")).toBe("yes");

  await vi.advanceTimersByTimeAsync(5000);
  const recent = screen.getByRole("region", { name: "Recent videos" });
  await waitFor(() => expect(within(recent).getByText("Download MP4")).toBeTruthy());
  expect(within(recent).getByText("Midnight noodles")).toBeTruthy();
});

test("states the 10 MB pick limit and refuses a photo over it", () => {
  renderWithIntl(<EffectGenerator {...props} />);

  expect(screen.getByText(/^JPEG, PNG or WebP, up to 10 MB\./)).toBeTruthy();
  const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo", { selector: "input" }), { target: { files: [big] } });

  expect(screen.getByRole("alert").textContent).toBe("Use a JPEG, PNG or WebP photo up to 10 MB.");
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();
});

// jsdom can't decode, so a photo over the 4 MB upload limit can't shrink.
test("refuses a photo still over the upload limit after shrinking", async () => {
  renderWithIntl(<EffectGenerator {...props} />);

  const big = new File([new Uint8Array(4.5 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo", { selector: "input" }), { target: { files: [big] } });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "This photo is too large to upload, even made smaller. Try another photo.",
  );
});

test.each([
  [402, "INSUFFICIENT_CREDITS", "Not enough credits"],
  [422, "CONTENT_BLOCKED", "The photo was blocked by content moderation. Try a different one."],
  [400, "INVALID_IMAGE_SIZE", "Use a photo 240 to 8,000 pixels on each side"],
  [503, "VIDEOS_DISABLED", "isn't set up yet"],
])("explains a %s reply", async (status, error, text) => {
  fetchMock.mockResolvedValueOnce(reply(status, { error }));
  renderWithIntl(<EffectGenerator {...props} />);

  await pick();
  agree();
  fireEvent.click(submit());

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(text));
});

test("a short balance turns the button into Buy credits, which opens the dialog", () => {
  renderWithIntl(<EffectGenerator {...props} balance={5} enabled={false} />);

  expect(screen.getByText("The window peeper video isn't set up yet.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Buy credits" }));
  expect(openBuy).toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

// next-intl reports ENVIRONMENT_FALLBACK when relativeTime gets no `now`.
test("a ready video says how long ago it was made, with the current time passed in", () => {
  vi.useFakeTimers({ now: new Date("2026-10-15T00:05:00.000Z"), toFake: ["Date"] });
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const ready = {
    ...pending,
    status: "succeeded" as const,
    url: "https://storage.test/new.mp4",
    createdAt: new Date("2026-10-15T00:00:00.000Z"),
  };
  renderWithIntl(<EffectGenerator {...props} videos={[ready]} />);

  const recent = screen.getByRole("region", { name: "Recent videos" });
  expect(within(recent).getByText("Ready · 5 minutes ago")).toBeTruthy();
  expect(errors.mock.calls.flat().join(" ")).not.toContain("ENVIRONMENT_FALLBACK");
  errors.mockRestore();
});

test("records the dashboard's funnel steps, without the photo", async () => {
  fetchMock.mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }));
  renderWithIntl(<EffectGenerator {...props} />);

  await pick();
  agree();
  fireEvent.click(submit());

  await waitFor(() => expect(openBuy).toHaveBeenCalled());
  expect(track.mock.calls).toEqual([
    ["photo_selected", { surface: "dashboard" }],
    ["generate_clicked", { surface: "dashboard", quality: "standard", ratio: "9:16" }],
    ["paywall_viewed", { surface: "dashboard", quality: "standard", credits_needed: 10 }],
  ]);
  expect(JSON.stringify(track.mock.calls)).not.toContain("me.jpg");
});

test("a short balance records the paywall, not a generate click", () => {
  renderWithIntl(<EffectGenerator {...props} balance={5} />);

  fireEvent.click(screen.getByRole("button", { name: "Buy credits" }));

  expect(track.mock.calls).toEqual([["paywall_viewed", { surface: "dashboard", quality: "standard", credits_needed: 10 }]]);
});

test("records downloading a recent video", () => {
  const ready = { ...pending, status: "succeeded" as const, url: "https://storage.test/new.mp4", createdAt: new Date() };
  renderWithIntl(<EffectGenerator {...props} videos={[ready]} />);

  const download = screen.getByText("Download MP4");
  // jsdom doesn't navigate; the click is what counts.
  download.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(download);

  expect(track.mock.calls).toEqual([["video_downloaded", { surface: "dashboard" }]]);
});
