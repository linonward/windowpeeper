import { expect, test } from "vitest";
import { confirmLink } from "./magic-link";

test("points the email at the confirm page, keeping the token and the callback", () => {
  expect(confirmLink("https://app.test/api/auth/magic-link/verify?token=abc&callbackURL=%2Fen%2Fvideos")).toBe(
    "https://app.test/sign-in/confirm?token=abc&callbackURL=%2Fen%2Fvideos",
  );
});
