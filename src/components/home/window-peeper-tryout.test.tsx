import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const useSession = vi.fn();
const savePhotoDraft = vi.fn();
const loadPhotoDraft = vi.fn();
const clearPhotoDraft = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession, signIn: { social: vi.fn(), magicLink: vi.fn() } },
}));
vi.mock("@/lib/photo-draft", () => ({ savePhotoDraft, loadPhotoDraft, clearPhotoDraft }));
// src/lib/analytics.test.ts covers sending; this checks which steps fire.
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={`/en${href}`} {...props} />,
}));

const { WindowPeeperTryout } = await import("./window-peeper-tryout");

const fetchMock = vi.fn();
const signedIn = { data: { user: { id: "u1" } }, isPending: false };
const signedOut = { data: null, isPending: false };
const props = {
  credits: 10,
  proCredits: 20,
  maxPickBytes: 5 * 1024 * 1024,
  maxUploadBytes: 4 * 1024 * 1024,
  imageLimits: { minSide: 240, maxSide: 8000, maxRatio: 8 },
  enabled: true,
  packs: [
    { id: "small", credits: 10, amount: 499, currency: "usd" },
    { id: "medium", credits: 20, amount: 799, currency: "usd" },
    { id: "large", credits: 30, amount: 1199, currency: "usd" },
  ],
};
const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });
const pending = {
  id: "v1",
  prompt: "Window peeper",
  duration: 9,
  resolution: "720p",
  ratio: "16:9",
  preview: false,
  credits: 10,
  status: "pending",
  createdAt: "2026-10-16T00:00:00.000Z",
  url: null,
  imageUrl: "https://storage.test/v1.jpg",
  posterUrl: null,
};
const CONSENT_NOTE = "By making a video, you confirm the photo is yours, or the adult in it agreed.";
const PREVIEW = "Try a free 5-second preview";
const GENERATE = "Generate (10 credits)";
const GENERATE_PRO = "Generate (20 credits)";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  loadPhotoDraft.mockResolvedValue(null);
  savePhotoDraft.mockResolvedValue(undefined);
  clearPhotoDraft.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
  fetchMock.mockReset();
  window.history.replaceState(null, "", "/");
});

// jsdom can't decode images, so the photo is kept as picked; the form takes
// it once the (async) shrink step is done.
async function pick() {
  const file = new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [file] } });
  await screen.findByRole("img", { name: "Your photo preview" });
  return file;
}

// No box to tick: the note under the button says what pressing it confirms,
// and the request carries the consent the server records.
test("generating needs only a photo; the button's note says it confirms consent", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { video: pending }));
  renderWithIntl(<WindowPeeperTryout {...props} />);
  const button = screen.getByRole("button", { name: GENERATE });

  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.getByText(CONSENT_NOTE)).toBeDefined();
  await pick();
  expect(screen.getByRole("img", { name: "Your photo preview" }).getAttribute("src")).toBe("blob:preview");
  expect(button.hasAttribute("disabled")).toBe(false);

  fireEvent.click(button);
  await screen.findByRole("status");
  expect((fetchMock.mock.calls[0][1].body as FormData).get("consent")).toBe("yes");
});

test("standard is the default; Pro costs more and the button says so", () => {
  useSession.mockReturnValue(signedIn);
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const group = screen.getByRole("radiogroup", { name: "Quality" });
  expect(within(group).getAllByRole("radio")).toHaveLength(2);
  const standard = within(group).getByRole("radio", { name: /^Standard/ }) as HTMLInputElement;
  const pro = within(group).getByRole("radio", { name: /^Pro/ }) as HTMLInputElement;
  expect(standard.checked).toBe(true);
  expect(standard.labels?.[0].textContent).toContain("10 credits");
  expect(pro.labels?.[0].textContent).toContain("20 credits");
  expect(pro.labels?.[0].textContent).toContain("1080p, a sharper picture.");

  fireEvent.click(pro);

  expect(screen.getByRole("button", { name: GENERATE_PRO })).toBeDefined();
  expect(screen.queryByRole("button", { name: GENERATE })).toBeNull();
});

test("a Pro video sends quality pro, and without credits names the Pro price", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("radio", { name: /^Pro/ }));
  fireEvent.click(screen.getByRole("button", { name: GENERATE_PRO }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("This video costs 20 credits, and you don't have enough.");
  expect((fetchMock.mock.calls[0][1].body as FormData).get("quality")).toBe("pro");
});

test("a signed-out visitor's Pro choice is saved and sent after sign-in", async () => {
  useSession.mockReturnValue(signedOut);
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("radio", { name: /^Pro/ }));
  fireEvent.click(screen.getByRole("button", { name: GENERATE_PRO }));

  await screen.findByRole("dialog", { name: "Sign in to make your video" });
  expect(savePhotoDraft).toHaveBeenCalledWith("home:windowpeeper", {
    photos: [photo],
    fields: { consent: "yes", quality: "pro", ratio: "9:16" },
  });
  cleanup();

  useSession.mockReturnValue(signedIn);
  loadPhotoDraft.mockResolvedValue({ photos: [photo], fields: { consent: "yes", quality: "pro", ratio: "16:9" } });
  fetchMock.mockResolvedValue(reply(200, { video: { ...pending, credits: 20 } }));
  window.history.replaceState(null, "", "/en?try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await screen.findByRole("status");
  const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/videos/windowpeeper")!;
  expect((init.body as FormData).get("quality")).toBe("pro");
  // The form hides while the video renders, keeping the choice.
  expect((screen.getByRole("radio", { name: /^Pro/, hidden: true }) as HTMLInputElement).checked).toBe(true);
});

// Vertical fits TikTok, Reels and Shorts, where the meme lives, so there is
// no format to pick.
test("every video is vertical 9:16, with no format to pick, and plays in a tall frame", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(
    reply(200, { video: { ...pending, ratio: "9:16", status: "succeeded", url: "https://storage.test/v1.mp4" } }),
  );
  renderWithIntl(<WindowPeeperTryout {...props} />);

  expect(screen.queryByRole("radiogroup", { name: "Format" })).toBeNull();
  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));

  const player = await screen.findByLabelText("Your window peeper video");
  expect((fetchMock.mock.calls[0][1].body as FormData).get("ratio")).toBe("9:16");
  expect(player.className).toContain("aspect-[9/16]");
});

// The free preview is a quiet link under the one button, not a third choice.
test("offers one free preview under the button, never free credits", async () => {
  useSession.mockReturnValue(signedOut);
  const { container } = renderWithIntl(<WindowPeeperTryout {...props} />);

  const preview = screen.getByRole("button", { name: PREVIEW });
  expect(preview.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(/with a watermark, once per account/)).toBeDefined();
  expect(container.textContent).not.toMatch(/free credits/i);
  await pick();
  expect(preview.hasAttribute("disabled")).toBe(false);
});

test("a free preview sends quality preview and, once ready, offers the full video", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(
    reply(200, {
      video: { ...pending, preview: true, credits: 0, duration: 5, status: "succeeded", url: "https://storage.test/v1.mp4" },
    }),
  );
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: PREVIEW }));

  expect(await screen.findByText(/^This is your free preview/)).toBeDefined();
  const form = fetchMock.mock.calls[0][1].body as FormData;
  expect(form.get("quality")).toBe("preview");
  expect(form.get("consent")).toBe("yes");
});

test("a signed-out visitor's free preview is saved and signs in", async () => {
  useSession.mockReturnValue(signedOut);
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("button", { name: PREVIEW }));

  await screen.findByRole("dialog", { name: "Sign in to make your video" });
  expect(savePhotoDraft).toHaveBeenCalledWith("home:windowpeeper", {
    photos: [photo],
    fields: { consent: "yes", quality: "preview", ratio: "9:16" },
  });
});

test("a used free preview says so and leaves Standard picked", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(409, { error: "PREVIEW_USED" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: PREVIEW }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("You've already used your free preview.");
  expect((screen.getByRole("radio", { name: /^Standard/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("button", { name: GENERATE })).toBeDefined();
});

test("a photo over the 5 MB pick limit is dropped with a clear error", () => {
  useSession.mockReturnValue(signedIn);
  renderWithIntl(<WindowPeeperTryout {...props} />);

  expect(screen.getByText(/^JPEG, PNG or WebP, up to 5 MB\./)).toBeDefined();
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [big] } });

  expect(screen.getByRole("alert").textContent).toBe("Use a JPEG, PNG or WebP photo up to 5 MB.");
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();
});

// src/components/videos/use-photo-picks.test.ts covers shrinking; jsdom
// can't decode, so a photo over the 4 MB upload limit stays too large.
test("a photo still over the upload limit after shrinking is dropped", async () => {
  useSession.mockReturnValue(signedIn);
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const big = new File([new Uint8Array(4.5 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [big] } });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "This photo is too large to upload, even made smaller. Try another photo.",
  );
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();
});

// The file input is hidden behind a dashed zone that names it, so the
// browser's "Choose File / No file chosen" never shows.
test("the photo zone asks for a photo, then shows it with its name and a way to change it", async () => {
  useSession.mockReturnValue(signedIn);
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const input = screen.getByLabelText("Your photo");
  expect(input.className).toContain("sr-only");
  const zone = screen.getByText("Choose a photo").closest("label") as HTMLElement;
  expect(zone.getAttribute("for")).toBe(input.id);
  expect(zone.textContent).toContain("Click to browse, or drop it here");

  await pick();
  expect(zone.textContent).toContain("me.jpg");
  expect(zone.textContent).toContain("Change photo");
  expect(within(zone).getByRole("img", { name: "Your photo preview" })).toBeDefined();
});

test("dropping an image on the zone picks it; another file type shows the error", async () => {
  useSession.mockReturnValue(signedIn);
  renderWithIntl(<WindowPeeperTryout {...props} />);
  const zone = screen.getByText("Choose a photo").closest("label") as HTMLElement;

  const pdf = new File([new Uint8Array(10)], "cv.pdf", { type: "application/pdf" });
  fireEvent.drop(zone, { dataTransfer: { files: [pdf] } });
  expect(screen.getByRole("alert").textContent).toBe("Use a JPEG, PNG or WebP photo up to 5 MB.");
  expect(screen.queryByRole("img", { name: "Your photo preview" })).toBeNull();

  const photo = new File([new Uint8Array(10)], "me.png", { type: "image/png" });
  fireEvent.drop(zone, { dataTransfer: { files: [photo] } });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(await screen.findByRole("img", { name: "Your photo preview" })).toBeDefined();
  expect(zone.textContent).toContain("me.png");
});

test("a signed-out visitor keeps the photo and consent, and signs in on this page", async () => {
  useSession.mockReturnValue(signedOut);
  window.history.replaceState(null, "", "/en");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));

  const dialog = await screen.findByRole("dialog", { name: "Sign in to make your video" });
  expect(dialog.textContent).toContain("Your photo stays picked");
  expect(within(dialog).getByRole("button", { name: "Continue with Google" })).toBeDefined();
  expect(savePhotoDraft).toHaveBeenCalledWith("home:windowpeeper", { photos: [photo], fields: { consent: "yes", quality: "standard", ratio: "9:16" } });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a session that ended answers 401, which also opens sign-in with the draft saved", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(401, { error: "UNAUTHORIZED" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));

  await screen.findByRole("dialog", { name: "Sign in to make your video" });
  expect(savePhotoDraft).toHaveBeenCalledWith("home:windowpeeper", {
    photos: [photo],
    fields: { consent: "yes", quality: "standard", ratio: "9:16" },
  });
});

test("back from sign-in, the saved photo and consent return and go out once", async () => {
  useSession.mockReturnValue(signedIn);
  const photo = new File(["a"], "me.jpg", { type: "image/jpeg" });
  loadPhotoDraft.mockResolvedValue({ photos: [photo], fields: { consent: "yes" } });
  fetchMock.mockResolvedValue(reply(200, { video: pending }));
  window.history.replaceState(null, "", "/en?try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await screen.findByRole("status");
  // Later renders don't send it again.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(loadPhotoDraft).toHaveBeenCalledWith("home:windowpeeper");
  const posts = fetchMock.mock.calls.filter(([url]) => url === "/api/videos/windowpeeper");
  expect(posts).toHaveLength(1);
  expect((posts[0][1].body as FormData).get("image1")).toBe(photo);
  expect((posts[0][1].body as FormData).get("consent")).toBe("yes");
  expect(clearPhotoDraft).toHaveBeenCalledWith("home:windowpeeper");
  expect(window.location.search).toBe("");
});

// Drafts saved before the box went away may lack consent: they come back,
// and wait for the visitor to press the button, which confirms it.
test("a draft without consent comes back but waits for the button", async () => {
  useSession.mockReturnValue(signedIn);
  loadPhotoDraft.mockResolvedValue({ photos: [new File(["a"], "me.jpg", { type: "image/jpeg" })], fields: {} });
  window.history.replaceState(null, "", "/en?try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await screen.findByRole("img", { name: "Your photo preview" });
  expect(screen.getByRole("button", { name: GENERATE }).hasAttribute("disabled")).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("without enough credits, it names the price and offers the packs, the smallest that pays picked", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("This video costs 10 credits, and you don't have enough.");
  const packs = screen.getByRole("radiogroup", { name: "Credit pack" });
  const small = within(packs).getByRole("radio", { name: /^10 credits/ }) as HTMLInputElement;
  expect(small.checked).toBe(true);
  expect(small.labels?.[0].textContent).toContain("$4.99");
  expect(small.labels?.[0].textContent).toContain("1 video");
  expect(within(packs).getByRole("radio", { name: /^20 credits/ }).closest("label")?.textContent).toContain(
    "1 Pro video or 2 videos",
  );
  expect(screen.getByRole("button", { name: "Pay $4.99 and make my video" })).toBeDefined();
  expect(screen.getByText(/Secure checkout/)).toBeDefined();
  expect(screen.queryByRole("link", { name: "Buy credits" })).toBeNull();
  expect(screen.getByRole("img", { name: "Your photo preview" })).toBeDefined();

  // Another pack changes the price on the button.
  fireEvent.click(within(packs).getByRole("radio", { name: /^30 credits/ }));
  expect(screen.getByRole("button", { name: "Pay $11.99 and make my video" })).toBeDefined();
});

test("for a Pro video, the medium pack is picked", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("radio", { name: /^Pro/ }));
  fireEvent.click(screen.getByRole("button", { name: GENERATE_PRO }));

  const packs = await screen.findByRole("radiogroup", { name: "Credit pack" });
  expect((within(packs).getByRole("radio", { name: /^20 credits/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("button", { name: "Pay $7.99 and make my video" })).toBeDefined();
});

test("paying saves the draft, then opens checkout that returns to the generator", async () => {
  useSession.mockReturnValue(signedIn);
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  fetchMock
    .mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }))
    .mockResolvedValueOnce(reply(200, { url: "https://checkout.test/s" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("radio", { name: /^Pro/ }));
  fireEvent.click(screen.getByRole("button", { name: GENERATE_PRO }));
  fireEvent.click(await screen.findByRole("button", { name: "Pay $7.99 and make my video" }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s"));
  expect(savePhotoDraft).toHaveBeenCalledWith("home:windowpeeper", {
    photos: [photo],
    fields: { consent: "yes", quality: "pro", ratio: "9:16" },
  });
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("/api/payment/checkout");
  expect(JSON.parse(init.body)).toEqual({ packId: "medium", locale: "en", returnTo: "home" });
  expect(savePhotoDraft.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
});

test("a checkout that can't start says why, in the generator", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock
    .mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }))
    .mockResolvedValueOnce(reply(503, { error: "PAYMENTS_DISABLED" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));
  fireEvent.click(await screen.findByRole("button", { name: "Pay $4.99 and make my video" }));

  expect(await screen.findByText("Payments aren't set up yet.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Pay $4.99 and make my video" }).hasAttribute("disabled")).toBe(false);
});

test("back from a payment, the draft returns and goes out once the credits arrive", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useSession.mockReturnValue(signedIn);
  const photo = new File(["a"], "me.jpg", { type: "image/jpeg" });
  loadPhotoDraft.mockResolvedValue({ photos: [photo], fields: { consent: "yes", quality: "pro", ratio: "16:9" } });
  const short = reply(402, { error: "INSUFFICIENT_CREDITS" });
  fetchMock
    // The progress poll's answer.
    .mockResolvedValue(reply(200, { video: { ...pending, credits: 20 } }))
    .mockResolvedValueOnce(short)
    .mockResolvedValueOnce(short)
    .mockResolvedValueOnce(reply(200, { video: { ...pending, credits: 20 } }));
  window.history.replaceState(null, "", "/en?checkout=success&try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  expect((await screen.findByRole("status")).textContent).toContain("Payment received");
  expect(window.location.search).toBe("");
  expect(screen.queryByRole("radiogroup", { name: "Credit pack" })).toBeNull();

  await vi.advanceTimersByTimeAsync(6000);
  expect((await screen.findByRole("status")).textContent).toContain("Your video is on its way");
  // Sent once it succeeded; no more tries after that.
  await vi.advanceTimersByTimeAsync(30_000);
  const posts = fetchMock.mock.calls.filter(([url]) => url === "/api/videos/windowpeeper");
  expect(posts).toHaveLength(3);
  expect((posts[2][1].body as FormData).get("quality")).toBe("pro");
  expect(clearPhotoDraft).toHaveBeenCalledWith("home:windowpeeper");
});

test("credits that don't arrive in time leave the form ready, with a message", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useSession.mockReturnValue(signedIn);
  loadPhotoDraft.mockResolvedValue({
    photos: [new File(["a"], "me.jpg", { type: "image/jpeg" })],
    fields: { consent: "yes", quality: "standard", ratio: "16:9" },
  });
  fetchMock.mockResolvedValue(reply(402, { error: "INSUFFICIENT_CREDITS" }));
  window.history.replaceState(null, "", "/en?checkout=success&try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await screen.findByRole("status");
  await vi.advanceTimersByTimeAsync(95_000);

  expect(
    await screen.findByText(
      "Your payment is being processed. Your credits will appear shortly; press Generate to try again.",
    ),
  ).toBeDefined();
  const sent = fetchMock.mock.calls.length;
  expect(sent).toBeGreaterThan(20);
  expect(sent).toBeLessThanOrEqual(31);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock.mock.calls.length).toBe(sent);
  expect(screen.getByRole("button", { name: GENERATE }).hasAttribute("disabled")).toBe(false);
});

test("back from a canceled payment, the draft and the packs return, and nothing is sent", async () => {
  useSession.mockReturnValue(signedIn);
  loadPhotoDraft.mockResolvedValue({
    photos: [new File(["a"], "me.jpg", { type: "image/jpeg" })],
    fields: { consent: "yes", quality: "pro", ratio: "16:9" },
  });
  window.history.replaceState(null, "", "/en?checkout=cancel&try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  expect(await screen.findByText("Payment canceled. You weren't charged.")).toBeDefined();
  expect(screen.getByRole("img", { name: "Your photo preview" })).toBeDefined();
  expect((screen.getByRole("radio", { name: /^Pro/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("button", { name: "Pay $7.99 and make my video" })).toBeDefined();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(window.location.search).toBe("");
});

test("back from a payment without a session, sign-in opens and nothing is sent", async () => {
  useSession.mockReturnValue(signedOut);
  loadPhotoDraft.mockResolvedValue({
    photos: [new File(["a"], "me.jpg", { type: "image/jpeg" })],
    fields: { consent: "yes", quality: "standard", ratio: "16:9" },
  });
  window.history.replaceState(null, "", "/en?checkout=success&try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await screen.findByRole("dialog", { name: "Sign in to make your video" });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("sends the photo, shows progress, then plays the video with download and share", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useSession.mockReturnValue(signedIn);
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, share });
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(
      reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/v1.mp4" } }),
    );
  window.history.replaceState(null, "", "/en");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  const photo = await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));

  expect((await screen.findByRole("status")).textContent).toContain("Your video is on its way");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/videos/windowpeeper");
  expect((init.body as FormData).get("image1")).toBe(photo);
  expect((init.body as FormData).get("quality")).toBe("standard");
  // The server records the consent the box gave.
  expect((init.body as FormData).get("consent")).toBe("yes");

  await vi.advanceTimersByTimeAsync(5000);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/videos/v1");
  const player = await screen.findByLabelText("Your window peeper video");
  expect(player.tagName).toBe("VIDEO");
  expect(player.getAttribute("src")).toBe("https://storage.test/v1.mp4");
  expect(player.hasAttribute("controls")).toBe(true);
  expect(screen.getByRole("link", { name: "Download" }).getAttribute("href")).toBe("/api/videos/v1/download");

  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(share.mock.calls[0][0]).toMatchObject({ url: `${window.location.origin}/en` });
});

test("without the share sheet, sharing copies the home page link", async () => {
  useSession.mockReturnValue(signedIn);
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
  fetchMock.mockResolvedValueOnce(
    reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/v1.mp4" } }),
  );
  window.history.replaceState(null, "", "/en");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));
  fireEvent.click(await screen.findByRole("button", { name: "Share" }));

  expect(await screen.findByText("Link copied")).toBeDefined();
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en`);
});

test("a failed video says the credits came back and lets them try again", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useSession.mockReturnValue(signedIn);
  fetchMock
    .mockResolvedValueOnce(reply(200, { video: pending }))
    .mockResolvedValueOnce(reply(200, { video: { ...pending, status: "failed" } }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));
  await screen.findByRole("status");
  await vi.advanceTimersByTimeAsync(5000);

  expect((await screen.findByRole("alert")).textContent).toBe(
    "This video didn't work out. Your 10 credits were refunded.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByRole("button", { name: GENERATE }).hasAttribute("disabled")).toBe(false);
});

test("when the effect is off, it says so and the form stays inert", () => {
  useSession.mockReturnValue(signedIn);
  renderWithIntl(<WindowPeeperTryout {...props} enabled={false} />);

  expect(screen.getByText("The window peeper video isn't set up yet.")).toBeDefined();
  expect(screen.getByLabelText("Your photo").matches(":disabled")).toBe(true);
  expect(screen.getByRole("button", { name: PREVIEW }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: GENERATE }).hasAttribute("disabled")).toBe(true);
});

test("renders in Chinese", () => {
  useSession.mockReturnValue(signedOut);
  renderWithIntl(<WindowPeeperTryout {...props} />, "zh");

  expect(screen.getByRole("heading", { level: 2, name: "制作你的 Window Peeper 视频" })).toBeDefined();
  expect(screen.getByRole("button", { name: "生成（10 积分）" })).toBeDefined();
  expect(screen.getByRole("radio", { name: /^高画质/ })).toBeDefined();
});

const steps = () => track.mock.calls.map(([event, properties]) => (properties ? [event, properties] : [event]));

test("records each funnel step once per action, without the photo", async () => {
  useSession.mockReturnValue(signedIn);
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  fetchMock
    .mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }))
    .mockResolvedValueOnce(reply(200, { url: "https://checkout.test/s" }));
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("radio", { name: /^Pro/ }));
  fireEvent.click(screen.getByRole("button", { name: GENERATE_PRO }));
  fireEvent.click(await screen.findByRole("button", { name: "Pay $7.99 and make my video" }));
  await waitFor(() => expect(assign).toHaveBeenCalled());

  expect(steps()).toEqual([
    ["photo_selected"],
    ["generate_clicked", { quality: "pro", ratio: "9:16" }],
    ["paywall_viewed", { quality: "pro", credits_needed: 20 }],
    ["checkout_clicked", { pack_id: "medium", quality: "pro" }],
  ]);
  expect(JSON.stringify(track.mock.calls)).not.toContain("me.jpg");
});

test("a restored draft and the retries after a payment record no clicks or paywall", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  useSession.mockReturnValue(signedIn);
  const photo = new File(["a"], "me.jpg", { type: "image/jpeg" });
  loadPhotoDraft.mockResolvedValue({ photos: [photo], fields: { consent: "yes" } });
  fetchMock
    .mockResolvedValue(reply(200, { video: pending }))
    .mockResolvedValueOnce(reply(402, { error: "INSUFFICIENT_CREDITS" }))
    .mockResolvedValueOnce(reply(200, { video: pending }));
  window.history.replaceState(null, "", "/en?checkout=success&try=1");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  expect((await screen.findByRole("status")).textContent).toContain("Payment received");
  await vi.advanceTimersByTimeAsync(4000);
  expect(fetchMock.mock.calls.filter(([url]) => url === "/api/videos/windowpeeper")).toHaveLength(2);
  expect(track).not.toHaveBeenCalled();
});

test("records downloading and sharing the video, with how it was shared", async () => {
  useSession.mockReturnValue(signedIn);
  const share = vi.fn().mockRejectedValueOnce(new DOMException("closed", "AbortError")).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, share });
  fetchMock.mockResolvedValueOnce(
    reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/v1.mp4" } }),
  );
  window.history.replaceState(null, "", "/en");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));
  const download = await screen.findByRole("link", { name: "Download" });
  // jsdom doesn't navigate; the click is what counts.
  download.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(download);
  // Closing the share sheet shares nothing.
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(2));

  await waitFor(() =>
    expect(steps().slice(2)).toEqual([["video_downloaded"], ["video_shared", { method: "native" }]]),
  );
});

test("records a copied link as shared by copy", async () => {
  useSession.mockReturnValue(signedIn);
  vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  fetchMock.mockResolvedValueOnce(
    reply(200, { video: { ...pending, status: "succeeded", url: "https://storage.test/v1.mp4" } }),
  );
  window.history.replaceState(null, "", "/en");
  renderWithIntl(<WindowPeeperTryout {...props} />);

  await pick();
  fireEvent.click(screen.getByRole("button", { name: GENERATE }));
  fireEvent.click(await screen.findByRole("button", { name: "Share" }));

  await screen.findByText("Link copied");
  expect(steps().at(-1)).toEqual(["video_shared", { method: "copy" }]);
});
