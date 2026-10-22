// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createCheckout } from "@/server/payment/orders";
import { POST } from "./route";

vi.mock("@/app/api/_lib/with-session", () => ({
  withSession: (handler: (request: Request, context: object) => Promise<Response>) =>
    (request: Request) => handler(request, { session: { user: { id: "user-1", email: "a@example.com" } } }),
}));
vi.mock("@/server/payment/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/payment/orders")>()),
  createCheckout: vi.fn(),
}));
vi.mock("@/server/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", "https://app.test");
  vi.mocked(createCheckout).mockResolvedValue("https://checkout.test/s");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const post = (body: object) =>
  POST(new Request("http://localhost/api/payment/checkout", { method: "POST", body: JSON.stringify(body) }));
const urls = () => {
  const { successUrl, cancelUrl } = vi.mocked(createCheckout).mock.calls[0][0];
  return { successUrl, cancelUrl };
};

test("checkout returns to billing by default", async () => {
  const response = await post({ packId: "small", locale: "zh" });

  expect(await response.json()).toEqual({ url: "https://checkout.test/s" });
  expect(urls()).toEqual({
    successUrl: "https://app.test/zh/billing?checkout=success",
    cancelUrl: "https://app.test/zh/billing?checkout=cancel",
  });
});

test("returnTo home sends the buyer back to the home generator", async () => {
  await post({ packId: "medium", locale: "en", returnTo: "home" });

  expect(urls()).toEqual({
    successUrl: "https://app.test/en?checkout=success&try=1#generator",
    cancelUrl: "https://app.test/en?checkout=cancel&try=1#generator",
  });
});

test("any other returnTo, such as a URL, returns to billing", async () => {
  await post({ packId: "small", locale: "en", returnTo: "https://evil.test/" });

  expect(urls().successUrl).toBe("https://app.test/en/billing?checkout=success");
});
