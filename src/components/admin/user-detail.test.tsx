import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
}));

const { UserDetail } = await import("./user-detail");

afterEach(cleanup);

const user = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  createdAt: new Date("2026-01-02T00:00:00Z"),
  balance: 1250,
};
const transactions = [
  { id: "t1", amount: 25, reason: "admin", createdAt: new Date("2026-02-01T00:00:00Z") },
];
const subscription = {
  credits: 1000,
  amount: 900,
  currency: "usd",
  status: "active" as const,
  currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
};

test("shows the profile, balance and credit history", () => {
  renderWithIntl(
    <UserDetail user={user} subscription={subscription} transactions={transactions} />,
  );

  expect(screen.getByRole("link", { name: "All users" }).getAttribute("href")).toBe(
    "/en/admin/users",
  );
  const profile = screen.getByRole("region", { name: "Profile" });
  expect(within(profile).getByText("Ada")).toBeTruthy();
  expect(within(profile).getByText("Jan 2, 2026")).toBeTruthy();
  expect(within(profile).getByText("Verified")).toBeTruthy();
  expect(screen.getByText("1,250 credits")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add credits to ada@example.com" })).toBeTruthy();
  // V1 sells one-time packs only, so the subscription section is off.
  expect(screen.queryByRole("region", { name: "Subscription" })).toBeNull();
  const history = screen.getByRole("table", { name: "Credit history" });
  expect(history.textContent).toContain("Added by an admin");
  expect(history.textContent).toContain("+25");
});

test("says when the user has no name and an unverified email", () => {
  renderWithIntl(
    <UserDetail
      user={{ ...user, name: "", emailVerified: false }}
      subscription={null}
      transactions={[]}
    />,
    "es",
  );

  const profile = screen.getByRole("region", { name: "Perfil" });
  expect(within(profile).getByText("Sin definir")).toBeTruthy();
  expect(within(profile).getByText("Sin verificar")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Suscripción" })).toBeNull();
});
