import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { videoPrices } from "@/app/_lib/home-facts";
import { currentSession } from "@/app/_lib/session";
import { BuyCreditsProvider } from "@/components/billing/buy-credits";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { CreditsProvider } from "@/components/dashboard/credits";
import { MobileBar } from "@/components/dashboard/mobile-trigger";
import { ShellSkeleton } from "@/components/dashboard/shell-skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import { isAdmin } from "@/server/admin/access";
import { CREDIT_PACKS, DEFAULT_PACK_ID } from "@/server/payment/packs";
import { countVideos } from "@/server/videos";

// Signed-out crawlers are redirected to sign-in; noindex keeps these pages
// out of search results even if that redirect fails.
export const metadata: Metadata = { robots: { index: false } };

// Signed-in area with a sidebar shell. src/proxy.ts redirects early on a
// missing cookie; this layout verifies the session itself, behind Suspense
// so the session read doesn't block the static shell. Until then it shows
// the shell in outline.
export default function DashboardLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) return redirect({ href: "/sign-in", locale: await getLocale() });

  const { id, name, email } = session.user;
  const [balance, videos, cookieStore] = await Promise.all([userBalance(id), countVideos(id), cookies()]);
  const prices = videoPrices();
  // SidebarProvider saves the collapsed state in this cookie.
  const open = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <CreditsProvider balance={balance}>
      <BuyCreditsProvider packs={CREDIT_PACKS} prices={prices} featured={DEFAULT_PACK_ID}>
        <SidebarProvider defaultOpen={open}>
          <AppSidebar user={{ name, email }} isAdmin={isAdmin(email)} videos={videos} standardCredits={prices.standard} />
          <SidebarInset id="main-content" className="bg-background">
            <MobileBar />
            <div className="flex w-full max-w-[1240px] flex-1 flex-col gap-7 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 lg:px-12">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </BuyCreditsProvider>
    </CreditsProvider>
  );
}
