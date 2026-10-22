"use client";

import { Coins, Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useBuyCredits } from "@/components/billing/buy-credits";
import { Brand } from "@/components/layout/brand";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";
import { useCredits } from "./credits";

// Phones only: the menu button that opens the sidebar sheet, the lockup, the
// notification bell, and the balance as a lamp pill that opens the
// buy-credits dialog. The sheet
// closes once a link in it opens another page.
export function MobileBar() {
  const t = useTranslations("Dashboard");
  const { toggleSidebar, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
  const balance = useCredits()?.balance ?? 0;
  const buy = useBuyCredits();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={t("openMenu")}
          className="-m-1.5 flex size-9 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Menu className="size-[22px]" />
        </button>
        <Brand href="/videos" className="text-xl" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <button
          type="button"
          onClick={() => buy?.open()}
          aria-label={t("balancePill", { count: balance })}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary-soft px-2.5 py-1.5 font-mono text-[11px] font-semibold text-primary-text focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Coins aria-hidden className="size-3.5" />
          {t("balanceShort", { count: balance })}
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
