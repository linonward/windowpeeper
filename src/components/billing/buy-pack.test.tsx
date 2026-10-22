import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const useSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession } }));
// The form itself is tested in src/components/auth; this checks where it returns.
vi.mock("@/components/auth/login-form", () => ({
  LoginForm: ({ returnTo }: { returnTo?: string }) => <p data-testid="return-to">{returnTo}</p>,
}));

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track }));

const { BuyPack, CheckoutNotice } = await import("./buy-pack");

const fetchMock = vi.fn();
const assign = vi.fn();
const signedIn = { data: { user: { id: "u1" } }, isPending: false };
const signedOut = { data: null, isPending: false };
const pack = { id: "medium", credits: 50, amount: 2990, currency: "usd" };
const reply = (status: number, body: object) => ({ ok: status < 300, status, json: async () => body });

// The address bar's path after the last replaceState, as the stubbed
// location doesn't follow it.
const replaced = () => {
  const call = vi.mocked(window.history.replaceState).mock.lastCall;
  return call && new URL(String(call[2]), "http://localhost").pathname + new URL(String(call[2]), "http://localhost").search;
};

const realLocation = window.location;

function at(path: string) {
  window.history.replaceState(null, "", path);
  vi.stubGlobal("location", { ...realLocation, assign });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  at("/pricing");
  vi.spyOn(window.history, "replaceState");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  fetchMock.mockReset();
  window.history.replaceState(null, "", "/");
});

const button = () => screen.getByRole("button", { name: "Buy 5 videos" });
const render = (returnTo: "pricing" | "packs" = "pricing") =>
  renderWithIntl(<BuyPack pack={pack} returnTo={returnTo}>Buy 5 videos</BuyPack>);

test("a signed-in buyer goes straight to checkout and comes back to this page", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { url: "https://checkout.test/s" }));
  render();

  fireEvent.click(button());

  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s"));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/payment/checkout");
  expect(JSON.parse(init.body)).toEqual({ packId: "medium", locale: "en", returnTo: "pricing" });
  expect(track.mock.calls).toEqual([["checkout_clicked", { surface: "pricing", pack_id: "medium" }]]);
});

test("a signed-out visitor signs in on this page, which then opens checkout for the pack", async () => {
  useSession.mockReturnValue(signedOut);
  render("packs");

  fireEvent.click(button());

  await screen.findByRole("dialog", { name: "Sign in to buy credits" });
  expect(screen.getByTestId("return-to").textContent).toBe("/pricing?buy=medium");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(track.mock.calls).toEqual([["checkout_clicked", { surface: "packs", pack_id: "medium" }]]);
});

test("back from sign-in with ?buy, checkout opens for that pack", async () => {
  at("/pricing?buy=medium");
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(200, { url: "https://checkout.test/s" }));
  render();

  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s"));
  expect(replaced()).toBe("/pricing");
  // The click before sign-in counted already.
  expect(track).not.toHaveBeenCalled();
});

test("?buy for another pack opens nothing", async () => {
  at("/pricing?buy=large");
  useSession.mockReturnValue(signedIn);
  render();

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a session that ended answers 401, which opens sign-in", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(401, { error: "UNAUTHORIZED" }));
  render();

  fireEvent.click(button());

  await screen.findByRole("dialog", { name: "Sign in to buy credits" });
});

test("a checkout that can't start says why", async () => {
  useSession.mockReturnValue(signedIn);
  fetchMock.mockResolvedValueOnce(reply(503, { error: "PAYMENTS_DISABLED" }));
  render();

  fireEvent.click(button());

  expect((await screen.findByRole("alert")).textContent).toBe("Payments aren't set up yet.");
  expect(assign).not.toHaveBeenCalled();
});

test.each([
  ["success", "Payment received. Your credits arrive within a minute."],
  ["cancel", "Checkout canceled. You weren't charged."],
])("back from checkout (%s), the page says so and drops the query", (checkout, message) => {
  at(`/pricing?checkout=${checkout}`);
  renderWithIntl(<CheckoutNotice />);

  expect(screen.getByRole("status").textContent).toContain(message);
  expect(replaced()).toBe("/pricing");
});

// The generator's own return (?try=1) has its own messages.
test("a checkout the generator started shows no notice here", () => {
  at("/?checkout=success&try=1");
  renderWithIntl(<CheckoutNotice />);

  expect(screen.queryByRole("status")).toBeNull();
});

test("after a payment, the notice leads to the generator", () => {
  at("/pricing?checkout=success");
  renderWithIntl(<CheckoutNotice />);

  expect(screen.getByRole("link", { name: "Make a video" }).getAttribute("href")).toBe("/#generator");
});

test("without a checkout, there is no notice", () => {
  renderWithIntl(<CheckoutNotice />);

  expect(screen.queryByRole("status")).toBeNull();
});
