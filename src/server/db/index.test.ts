import { afterEach, expect, test, vi } from "vitest";

const context = vi.hoisted(() => ({ ctx: {} as object }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => context }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  vi.stubEnv("DATABASE_URL", "postgres://starter:starter@localhost:5432/starter");
  return import("./index");
}

test("a server process shares one database client", async () => {
  const { getDb } = await load();
  expect(getDb()).toBe(getDb());
});

// A Worker can't use a connection opened by another request. Better Auth
// keeps the client it got at startup, so that client must follow the
// request it's used in.
test("in a Cloudflare Worker, each request gets its own pool, even through a kept client", async () => {
  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
  const { getDb } = await load();

  context.ctx = {};
  const kept = getDb();
  const first = kept.$client;
  expect(getDb().$client).toBe(first);

  context.ctx = {};
  expect(kept.$client).not.toBe(first);
  expect(getDb().$client).toBe(kept.$client);
});
