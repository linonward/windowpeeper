"use client";

import { Clapperboard, CreditCard, Film, MessageSquare, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { useBuyCredits } from "@/components/billing/buy-credits";
import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { useCredits } from "./credits";
import { markSidebarCollapsed } from "./sidebar-state";
import { UserMenu } from "./user-menu";

// Grouped by what the user came to do, each group under a mono label
// (hidden in the collapsed sidebar). `count` shows the user's videos.
const CREATE = [
  { href: "/videos/windowpeeper", key: "newVideo", icon: Clapperboard },
  { href: "/videos/library", key: "myVideos", icon: Film, count: true },
] as const;

const ACCOUNT = [
  { href: "/billing", key: "billing", icon: CreditCard },
  { href: "/profile", key: "profile", icon: UserRound },
  { href: "/feedback", key: "feedback", icon: MessageSquare },
] as const;

// Shown only to admins. The admin pages check access themselves. /admin
// opens the first sub page, so Admin still works in the collapsed sidebar.
const ADMIN_ITEMS = [
  {
    href: "/admin",
    key: "admin",
    icon: ShieldCheck,
    children: [
      { href: "/admin/users", key: "adminUsers" },
      { href: "/admin/orders", key: "adminOrders" },
      { href: "/admin/metrics", key: "adminMetrics" },
      { href: "/admin/feedback", key: "adminFeedback" },
      { href: "/admin/notifications", key: "adminBroadcasts" },
    ],
  },
] as const;

type Key = Parameters<ReturnType<typeof useTranslations<"Dashboard">>>[0];

type Item = {
  href: string;
  key: Key;
  icon: React.ComponentType;
  count?: boolean;
  children?: readonly { href: string; key: Key }[];
};

type User = { name: string; email: string };

// docs/DESIGN.md, Dashboard: the lockup and the notification bell, the nav,
// then the credits card and the account menu at the bottom. `videos` is how many videos the user has.
export function AppSidebar({
  user,
  isAdmin,
  videos,
  standardCredits,
}: {
  user: User;
  isAdmin: boolean;
  videos: number;
  // A Standard video's price, to say what the balance buys.
  standardCredits: number;
}) {
  const t = useTranslations("Dashboard");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="flex-row items-center justify-between gap-1 pt-6 pr-2 pb-2 pl-[22px] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Brand href="/videos" className="text-xl group-data-[collapsible=icon]:hidden" />
        <SidebarBell />
        <CollapseState />
      </SidebarHeader>
      <SidebarContent className="gap-6 px-3.5 pt-4 group-data-[collapsible=icon]:px-0">
        <nav aria-label={t("nav")} className="flex flex-col gap-6">
          <NavGroup label={t("groups.create")} items={CREATE} videos={videos} />
          <NavGroup label={t("groups.account")} items={ACCOUNT} />
          {isAdmin && <NavGroup items={ADMIN_ITEMS} />}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-4 px-3.5 pb-5">
        <CreditsCard standardCredits={standardCredits} />
        <UserMenu {...user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// One group of links. With a label, the list is named by it.
function NavGroup({ label, items, videos }: { label?: string; items: readonly Item[]; videos?: number }) {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const labelId = useId();

  return (
    <SidebarGroup className="p-0">
      {label && (
        <SidebarGroupLabel
          id={labelId}
          className="h-auto px-0 pb-2 font-mono text-[10px] font-normal tracking-[0.15em] text-faint uppercase"
        >
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5" aria-labelledby={label ? labelId : undefined}>
          {items.map(({ href, key, icon: Icon, count, children }) => {
            const within = pathname === href || pathname.startsWith(`${href}/`);
            // A parent with sub pages is highlighted, but the sub item is the page.
            const current = within && !children?.some((c) => pathname === c.href);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={within}
                  tooltip={t(key)}
                  className="h-auto gap-2.5 rounded-sm px-2.5 py-[9px] text-sm font-medium text-muted-foreground data-active:bg-primary-soft data-active:font-semibold data-active:text-primary-text [&_svg]:size-[18px]"
                  render={<Link href={href} aria-current={current ? "page" : undefined} />}
                >
                  <Icon />
                  <span className="flex-1">{t(key)}</span>
                  {count && videos !== undefined && (
                    <span className="font-mono text-[11px] text-faint group-data-[collapsible=icon]:hidden">{videos}</span>
                  )}
                </SidebarMenuButton>
                {children && (
                  <SidebarMenuSub className="mt-1">
                    {children.map((child) => (
                      <SidebarMenuSubItem key={child.href}>
                        <SidebarMenuSubButton
                          isActive={pathname === child.href || pathname.startsWith(`${child.href}/`)}
                          className="h-8 rounded-sm data-active:bg-transparent data-active:font-semibold data-active:text-primary-text"
                          render={<Link href={child.href} aria-current={pathname === child.href ? "page" : undefined} />}
                        >
                          <span>{t(child.key)}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// The balance, what it buys, and a button that opens the buy-credits dialog.
function CreditsCard({ standardCredits }: { standardCredits: number }) {
  const t = useTranslations("Dashboard");
  const balance = useCredits()?.balance ?? 0;
  const buy = useBuyCredits();

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 group-data-[collapsible=icon]:hidden">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] tracking-[0.15em] text-faint uppercase">{t("credits")}</span>
          <span className="font-display text-4xl leading-none font-extrabold tabular-nums">{balance}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("creditsBuy", { videos: Math.floor(balance / standardCredits) })}
        </span>
      </div>
      <Button variant="outline" className="h-9 w-full" onClick={() => buy?.open()}>
        {t("buyCredits")}
      </Button>
    </div>
  );
}

// Keeps the collapsed state in the cookie the server reads (sidebar-state).
// Beside the lockup on desktop, opening to the right. Phones have the bell
// in the top bar instead.
function SidebarBell() {
  const { isMobile } = useSidebar();
  return isMobile ? null : <NotificationBell side="right" />;
}

function CollapseState() {
  const { state } = useSidebar();
  useEffect(() => markSidebarCollapsed(state === "collapsed"), [state]);
  return null;
}
