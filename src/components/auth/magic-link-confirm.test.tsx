import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { MagicLinkConfirm } from "./magic-link-confirm";

afterEach(cleanup);

test("signs in only when the visitor presses the button, so link scanners don't spend the link", () => {
  renderWithIntl(<MagicLinkConfirm token="abc" callbackURL="/en/videos" errorCallbackURL="/sign-in?next=%2Fvideos" />);

  const button = screen.getByRole("button", { name: "Continue signing in" });
  const form = button.closest("form");
  expect(form?.getAttribute("method")).toBe("get");
  expect(form?.getAttribute("action")).toBe("/api/auth/magic-link/verify");
  const fields = Object.fromEntries(new FormData(form as HTMLFormElement));
  // A spent or expired link returns to sign-in, which says so.
  expect(fields).toEqual({ token: "abc", callbackURL: "/en/videos", errorCallbackURL: "/sign-in?next=%2Fvideos" });
});

test("leaves the callback out when the link has none", () => {
  renderWithIntl(<MagicLinkConfirm token="abc" />);

  const form = screen.getByRole("button", { name: "Continue signing in" }).closest("form");
  expect(Object.fromEntries(new FormData(form as HTMLFormElement))).toEqual({ token: "abc" });
});

test("a link without a token sends the visitor back to sign in", () => {
  renderWithIntl(<MagicLinkConfirm />, "es");

  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("link", { name: "Volver a iniciar sesión" }).getAttribute("href")).toBe("/es/sign-in");
});
