import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const social = vi.fn();
const magicLink = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social, magicLink } },
}));
// Stands in for the Cloudflare widget: a button that hands over a token.
vi.mock("./turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button type="button" onClick={() => onToken("turnstile-token")}>
      Solve challenge
    </button>
  ),
}));

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track }));

const { LoginForm } = await import("./login-form");

afterEach(() => {
  cleanup();
  social.mockReset();
  magicLink.mockReset();
  track.mockReset();
});

function sendMagicLink() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
}

test("starts Google sign-in and returns to the videos page", async () => {
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(social).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/videos",
    errorCallbackURL: "/sign-in?next=%2Fvideos",
  });
});

test("explains when Google sign-in isn't configured", async () => {
  social.mockResolvedValue({
    data: null,
    error: { status: 404, code: "PROVIDER_NOT_FOUND" },
  });
  renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Google sign-in isn't available. Use a magic link instead.",
  );
});

test.each([
  ["/billing", "/billing"],
  ["/videos/library?page=2", "/videos/library?page=2"],
  // Anything that could leave the site falls back to the dashboard.
  ["//evil.example", "/videos"],
  ["https://evil.example", "/videos"],
  ["/\\evil.example", "/videos"],
  ["/\t/evil.example", "/videos"],
  ["", "/videos"],
])("with ?next=%j, signs in and returns to %s", async (next, callbackURL) => {
  window.history.replaceState(null, "", `/sign-in?next=${encodeURIComponent(next)}`);
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(social).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", callbackURL }));
  window.history.replaceState(null, "", "/");
});

test("a form in a dialog returns to the page that opened it, not to ?next=", async () => {
  window.history.replaceState(null, "", "/sign-in?next=%2Fen%2Fbilling");
  const callbackURL = "/pricing?try=1";
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  magicLink.mockResolvedValue({ data: { status: true }, error: null });

  renderWithIntl(<LoginForm returnTo={callbackURL} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(social).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", callbackURL }));

  cleanup();
  renderWithIntl(<LoginForm returnTo={callbackURL} />);
  sendMagicLink();
  expect(magicLink).toHaveBeenCalledWith(expect.objectContaining({ callbackURL }));
  window.history.replaceState(null, "", "/");
});

test("without Turnstile, sends the magic link with no challenge", async () => {
  magicLink.mockResolvedValue({ data: { status: true }, error: null });
  renderWithIntl(<LoginForm />);

  expect(screen.queryByRole("button", { name: "Solve challenge" })).toBeNull();
  sendMagicLink();

  await screen.findByRole("status");
  expect(magicLink).toHaveBeenCalledWith({
    email: "ada@example.com",
    callbackURL: "/videos",
    errorCallbackURL: "/sign-in?next=%2Fvideos",
    fetchOptions: { headers: {} },
  });
});

test("with Turnstile, waits for the challenge and sends its token", async () => {
  magicLink.mockResolvedValue({ data: { status: true }, error: null });
  renderWithIntl(<LoginForm turnstileSiteKey="site-key" />);

  const send = screen.getByRole("button", { name: "Email me a sign-in link" });
  expect(send).toHaveProperty("disabled", true);

  fireEvent.click(screen.getByRole("button", { name: "Solve challenge" }));
  expect(send).toHaveProperty("disabled", false);
  sendMagicLink();

  await screen.findByRole("status");
  expect(magicLink).toHaveBeenCalledWith({
    email: "ada@example.com",
    callbackURL: "/videos",
    errorCallbackURL: "/sign-in?next=%2Fvideos",
    fetchOptions: { headers: { "x-captcha-response": "turnstile-token" } },
  });
});

test("a token is used once: after a failed send, the challenge runs again", async () => {
  magicLink.mockResolvedValue({ data: null, error: { status: 400 } });
  renderWithIntl(<LoginForm turnstileSiteKey="site-key" />);

  fireEvent.click(screen.getByRole("button", { name: "Solve challenge" }));
  sendMagicLink();

  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Email me a sign-in link" })).toHaveProperty("disabled", true);
});

// The method is kept in this browser only, never sent to the server.
test("tags the method used last on this device", async () => {
  localStorage.setItem("windowpeeper:last-sign-in", "email");
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  renderWithIntl(<LoginForm />);

  const send = screen.getByRole("button", { name: "Email me a sign-in link" });
  expect(send.parentElement?.textContent).toContain("Last used");
  expect(screen.getAllByText("Last used")).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(localStorage.getItem("windowpeeper:last-sign-in")).toBe("google");
  localStorage.clear();
});

test("with no method used yet, nothing is tagged", () => {
  renderWithIntl(<LoginForm />);

  expect(screen.queryByText("Last used")).toBeNull();
});

test("shows an example address and links the terms and the privacy policy", () => {
  renderWithIntl(<LoginForm />);

  expect(screen.getByLabelText("Email").getAttribute("placeholder")).toBe("you@example.com");
  expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
  expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
});

test("says where the link went and how long it lasts", async () => {
  magicLink.mockResolvedValue({ data: {}, error: null });
  renderWithIntl(<LoginForm />);

  sendMagicLink();

  const status = await screen.findByRole("status");
  expect(status.textContent).toContain("ada@example.com");
  expect(status.textContent).toContain("expires in 5 minutes");
  expect(localStorage.getItem("windowpeeper:last-sign-in")).toBe("email");
  localStorage.clear();
});

// Better Auth adds ?error= to errorCallbackURL when a sign-in fails.
test.each([
  ["EXPIRED_TOKEN", "That sign-in link has expired or was already used. Send a new one."],
  ["INVALID_TOKEN", "That sign-in link has expired or was already used. Send a new one."],
  ["access_denied", "Sign-in didn't finish. Try again."],
])("back from a failed sign-in (%s), says why", (error, message) => {
  window.history.replaceState(null, "", `/sign-in?next=%2Fbilling&error=${error}`);
  renderWithIntl(<LoginForm />);

  expect(screen.getByRole("alert").textContent).toBe(message);
  window.history.replaceState(null, "", "/");
});

test("records a sign-in started with Google, or a link sent by email", async () => {
  social.mockResolvedValue({ data: { redirect: true }, error: null });
  magicLink.mockResolvedValueOnce({ data: null, error: { status: 500 } }).mockResolvedValueOnce({ data: {}, error: null });
  const view = renderWithIntl(<LoginForm />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  view.unmount();
  renderWithIntl(<LoginForm />);
  // A link that failed to send started nothing.
  sendMagicLink();
  await screen.findByRole("alert");
  sendMagicLink();
  await screen.findByRole("status");

  expect(track.mock.calls).toEqual([
    ["sign_in_started", { method: "google" }],
    ["sign_in_started", { method: "email" }],
  ]);
  expect(JSON.stringify(track.mock.calls)).not.toContain("ada@");
});
