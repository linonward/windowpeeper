import { expect, test } from "vitest";
import { isCronRequest } from "./index";
import { sweepRequest } from "./scheduled";

const secret = "s".repeat(32);

test("a Cron Trigger's sweep is a signed POST to the app's sweep route", () => {
  const request = sweepRequest({ BETTER_AUTH_URL: "https://windowpeeper.org", CRON_SECRET: secret })!;

  expect(request.method).toBe("POST");
  expect(request.url).toBe("https://windowpeeper.org/api/cron/sweep");
  expect(isCronRequest(request.headers, secret)).toBe(true);
});

test("without a secret or an origin there is nothing to send", () => {
  expect(sweepRequest({ BETTER_AUTH_URL: "https://windowpeeper.org" })).toBeNull();
  expect(sweepRequest({ CRON_SECRET: secret })).toBeNull();
});
