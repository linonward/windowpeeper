import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithIntl } from "@/test/intl";
import { CreditsProvider } from "./credits";
import { AppSidebar } from "./app-sidebar";

let pathname = "/videos/windowpeeper";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push() {} }),
  usePathname: () => pathname,
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
}));

beforeEach(() => {
  // jsdom has no media queries; render the desktop layout.
  window.matchMedia = vi.fn(
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as never,
  );
  pathname = "/videos/windowpeeper";
  openBuy.mockReset();
});

afterEach(cleanup);

const user = { name: "Ada Lovelace", email: "ada@example.com" };
const openBuy = vi.fn();
vi.mock("@/components/billing/buy-credits", () => ({ useBuyCredits: () => ({ open: openBuy }) }));

function renderSidebar(isAdmin: boolean) {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <SidebarProvider>
        <AppSidebar user={user} isAdmin={isAdmin} videos={12} standardCredits={10} />
      </SidebarProvider>
    </CreditsProvider>,
  );
  return screen.getByRole("navigation", { name: "Dashboard navigation" });
}

test("non-admins see no admin links", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Admin" })).toBeNull();
  expect(within(nav).queryByRole("link", { name: "Users" })).toBeNull();
});

test("admins see an Admin group with every admin page, like the other groups", () => {
  const nav = renderSidebar(true);

  const group = within(nav).getByRole("list", { name: "Admin" });
  expect(
    within(group)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Users", "/en/admin/users"],
    ["Orders", "/en/admin/orders"],
    ["Metrics", "/en/admin/metrics"],
    ["User feedback", "/en/admin/feedback"],
    ["Broadcasts", "/en/admin/notifications"],
  ]);
  expect(within(nav).queryByRole("link", { name: "Admin" })).toBeNull();
});

test("on a user's page, Users is highlighted but isn't the current page", () => {
  pathname = "/admin/users/u1";
  const nav = renderSidebar(true);

  const users = within(nav).getByRole("link", { name: "Users" });
  expect(users.hasAttribute("data-active")).toBe(true);
  expect(users.hasAttribute("aria-current")).toBe(false);
});

test("on an admin page, its item is the current page", () => {
  pathname = "/admin/notifications";
  const nav = renderSidebar(true);

  expect(within(nav).getByRole("link", { name: "Broadcasts" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Users" }).hasAttribute("data-active")).toBe(false);
});

test("the new video page is current on the generator", () => {
  const nav = renderSidebar(false);

  const link = within(nav).getByRole("link", { name: "New video" });
  expect(link.getAttribute("href")).toBe("/en/videos/windowpeeper");
  expect(link.getAttribute("aria-current")).toBe("page");
});

test("My videos leads to the library and counts the user's videos", () => {
  pathname = "/videos/library";
  const nav = renderSidebar(false);

  const link = within(nav).getByRole("link", { name: /My videos/ });
  expect(link.getAttribute("href")).toBe("/en/videos/library");
  expect(link.textContent).toBe("My videos12");
  expect(link.getAttribute("aria-current")).toBe("page");
});

// The loading skeleton reads this attribute on the next full page load.
test("mirrors the collapsed state on <html> for the loading skeleton", () => {
  renderSidebar(false);
  const html = document.documentElement;
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);
});

test("groups the video pages under Create, and the account pages under Account", () => {
  const nav = renderSidebar(false);

  const names = (group: string) =>
    within(within(nav).getByRole("list", { name: group }))
      .getAllByRole("link")
      .map((link) => link.textContent);
  expect(names("Create")).toEqual(["New video", "My videos12"]);
  expect(names("Account")).toEqual(["Billing", "Profile", "Feedback"]);
});

test("the credits card shows the balance and what it buys, and opens the buy-credits dialog", () => {
  renderSidebar(false);

  expect(screen.getByText("= 1 video")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Buy credits" }));
  expect(openBuy).toHaveBeenCalled();
});

test("the lockup leads back to the home page", () => {
  renderSidebar(false);

  expect(screen.getByRole("link", { name: "WindowPeeper" }).getAttribute("href")).toBe("/en/");
});
