import { expect, test } from "vitest";
import { signupCredits } from "./config";

// The pricing page, billing and the home page promise no free credits.
test("new accounts get no free credits", () => {
  expect(signupCredits).toBe(0);
});
