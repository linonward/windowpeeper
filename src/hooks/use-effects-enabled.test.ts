import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useEffectsEnabled } from "./use-effects-enabled";

const fetchMock = vi.fn<(url: string) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const reply = (status: number, body: object = {}) => new Response(JSON.stringify(body), { status });

test("starts on, and asks the server once", async () => {
  fetchMock.mockResolvedValue(reply(200, { enabled: true }));
  const { result } = renderHook(() => useEffectsEnabled());

  expect(result.current).toBe(true);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/videos/enabled"));
  expect(result.current).toBe(true);
});

test("turns off when the server says the effects are off", async () => {
  fetchMock.mockResolvedValue(reply(200, { enabled: false }));
  const { result } = renderHook(() => useEffectsEnabled());

  await waitFor(() => expect(result.current).toBe(false));
});

test("stays on when the server can't be asked, so a send reports the real error", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("offline"));
  const { result } = renderHook(() => useEffectsEnabled());
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  fetchMock.mockResolvedValueOnce(reply(500, { enabled: false }));
  const again = renderHook(() => useEffectsEnabled());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

  expect(result.current).toBe(true);
  expect(again.result.current).toBe(true);
});
