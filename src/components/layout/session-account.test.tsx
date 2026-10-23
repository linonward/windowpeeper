import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SessionAccount } from "./session-account";

let session: { user: { id: string } } | null = null;
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: session, isPending: false, error: null }) } }));

afterEach(() => { cleanup(); session = null; });

test("visitors without a session see the signed-out button", () => {
  render(<SessionAccount signedOut="Sign in" signedIn="Dashboard" />);

  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(screen.queryByText("Dashboard")).toBeNull();
});

test("signed-in users see the signed-in button", () => {
  session = { user: { id: "u1" } };
  render(<SessionAccount signedOut="Sign in" signedIn="Dashboard" />);

  expect(screen.getByText("Dashboard")).toBeTruthy();
  expect(screen.queryByText("Sign in")).toBeNull();
});
