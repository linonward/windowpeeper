import { afterEach, expect, it, vi } from "vitest";
import { resolveIdentity, track } from "./analytics";
import { recordFirstTouch } from "./first-touch";

afterEach(() => {
  localStorage.clear();
  document.cookie = "rs_ft=; Path=/; Max-Age=0";
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function enabled() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com/");
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const bodies = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.map((call) => JSON.parse(call[1].body));

it("sends nothing while analytics is off", () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);

  track("generate_clicked", { quality: "pro" });

  expect(fetcher).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});

it("sends one event per call, with the app, the choice and nothing else", () => {
  const fetcher = enabled();

  track("generate_clicked", { quality: "pro" });

  expect(fetcher).toHaveBeenCalledExactlyOnceWith("https://us.i.posthog.com/i/v0/e/", expect.objectContaining({
    credentials: "omit", referrerPolicy: "no-referrer",
  }));
  const [body] = bodies(fetcher);
  expect(body).toMatchObject({
    api_key: "phc_test",
    event: "generate_clicked",
    distinct_id: expect.stringMatching(/^windowpeeper:anonymous:/),
    properties: { app: "windowpeeper", quality: "pro", $process_person_profile: false, $geoip_disable: true },
  });
});

it("sends as the account the page views identified, with the first touch", () => {
  const fetcher = enabled();
  window.history.replaceState(null, "", "/en?utm_source=tiktok");
  recordFirstTouch();
  resolveIdentity("account-1");

  track("checkout_clicked", { pack_id: "small", quality: "standard" });

  expect(bodies(fetcher)[0]).toMatchObject({
    distinct_id: "windowpeeper:account-1",
    properties: {
      pack_id: "small", quality: "standard", $process_person_profile: true,
      $set_once: { $initial_utm_source: "tiktok", $initial_referrer: "$direct", $initial_pathname: "/en" },
    },
  });
  window.history.replaceState(null, "", "/");
});

it("keeps the same anonymous ID across events", () => {
  const fetcher = enabled();

  track("photo_selected");
  track("video_shared", { method: "copy" });

  const [first, second] = bodies(fetcher);
  expect(second.distinct_id).toBe(first.distinct_id);
});
