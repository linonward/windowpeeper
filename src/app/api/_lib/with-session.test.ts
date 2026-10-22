import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { getSession, hitLimit } = vi.hoisted(() => ({
  getSession: vi.fn<(headers: Headers) => Promise<unknown>>(),
  hitLimit: vi.fn<(key: string, limit: object) => Promise<{ allowed: boolean; retryAfterMs?: number }>>(),
}));
vi.mock("@/server/auth/session", () => ({ getSession }));
vi.mock("@/server/ratelimit", () => ({ hitLimit }));

const { withSession } = await import("./with-session");

const session = { user: { id: "u1", email: "ada@example.com" } };
const handler = vi.fn(async () => Response.json({ ok: true }));

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
  getSession.mockResolvedValue(session);
  hitLimit.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const request = (method: string, headers: Record<string, string> = {}) =>
  new Request("https://app.example.com/api/things", { method, headers });

test("answers 401 without a session and never runs the handler", async () => {
  getSession.mockResolvedValue(null);

  const response = await withSession(handler)(request("GET"));

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  expect(handler).not.toHaveBeenCalled();
});

test("passes the session and the awaited params to the handler", async () => {
  const route = withSession<{ id: string }>(async (_request, { session, params }) =>
    Response.json({ user: (session as typeof session).user.id, id: params.id }),
  );

  const response = await route(request("GET"), { params: Promise.resolve({ id: "x" }) });

  expect(await response.json()).toEqual({ user: "u1", id: "x" });
});

test.each(["POST", "PUT", "PATCH", "DELETE"])("%s needs the app's own Origin", async (method) => {
  const route = withSession(handler);

  const foreign: Record<string, string>[] = [{}, { origin: "https://evil.example" }, { origin: "https://app.example.com.evil" }];
  for (const headers of foreign) {
    const response = await route(request(method, headers));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN_ORIGIN" });
  }
  expect(handler).not.toHaveBeenCalled();

  expect((await route(request(method, { origin: "https://app.example.com" }))).status).toBe(200);
});

test("GET needs no Origin", async () => {
  expect((await withSession(handler)(request("GET"))).status).toBe(200);
});

test("counts each user's hits per limit name, and answers 429 with Retry-After when over", async () => {
  const limit = { name: "video-poll", max: 10, windowMs: 60_000 };
  const route = withSession(handler, { limit });

  expect((await route(request("GET"))).status).toBe(200);
  expect(hitLimit).toHaveBeenCalledWith("api:video-poll:u1", limit);

  hitLimit.mockResolvedValue({ allowed: false, retryAfterMs: 12_300 });
  const response = await route(request("GET"));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("13");
  expect(await response.json()).toEqual({ error: "RATE_LIMITED" });
});

test("checks the Origin before it counts a hit", async () => {
  await withSession(handler, { limit: { name: "x", max: 1, windowMs: 1 } })(request("POST"));

  expect(hitLimit).not.toHaveBeenCalled();
});
