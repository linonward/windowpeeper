// @vitest-environment node
import { expect, test, vi } from "vitest";

const connection = vi.fn(async () => {});
const effectOptions = vi.fn();
vi.mock("next/server", () => ({ connection }));
vi.mock("@/server/videos", () => ({ effectOptions }));

const { GET } = await import("./route");

test("answers whether the effects are on, read per request", async () => {
  effectOptions.mockReturnValue({ enabled: false, credits: 10, proCredits: 20 });
  const response = await GET();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ enabled: false });
  // Without it, the build would prerender the build's answer.
  expect(connection).toHaveBeenCalled();
});
