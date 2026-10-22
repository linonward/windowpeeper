"use client";

import { LockKeyhole } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState } from "react";
import { useCredits } from "@/components/dashboard/credits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { type Pack, PackBenefits, PackOptions, useMoney, type VideoPrices } from "./packs";
import { redirectFrom } from "./redirect";

type BuyCredits = { open: () => void };

const BuyCreditsContext = createContext<BuyCredits | null>(null);

// The dashboard's one buy-credits dialog (docs/DESIGN.md, Buy credits): the
// balance and what it buys, the packs, the balance after the pick, and a pay
// button to checkout. Any button in the dashboard opens it through
// useBuyCredits().
export function BuyCreditsProvider({
  packs,
  prices,
  featured,
  children,
}: {
  packs: readonly Pack[];
  prices: VideoPrices;
  featured: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <BuyCreditsContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        {open && <BuyCreditsDialog packs={packs} prices={prices} featured={featured} />}
      </Dialog>
    </BuyCreditsContext.Provider>
  );
}

// Opens the dialog. Null outside the dashboard.
export function useBuyCredits() {
  return useContext(BuyCreditsContext);
}

function BuyCreditsDialog({ packs, prices, featured }: { packs: readonly Pack[]; prices: VideoPrices; featured: string }) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const money = useMoney();
  const balance = useCredits()?.balance ?? 0;
  const [picked, setPicked] = useState(featured);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pack = packs.find((each) => each.id === picked) ?? packs[0];
  const after = balance + pack.credits;
  const price = money(pack.amount, pack.currency);

  async function pay() {
    track("checkout_clicked", { surface: "buy_dialog", pack_id: pack.id });
    setBuying(true);
    setError(null);
    const code = await redirectFrom("/api/payment/checkout", { packId: pack.id, locale });
    if (code === null) return;
    setBuying(false);
    setError(t(code === "PAYMENTS_DISABLED" ? "disabled" : "checkoutError"));
  }

  return (
    <DialogContent closeLabel={t("close")} className="gap-6 p-5 sm:max-w-[620px] sm:p-8">
      <DialogHeader className="gap-1.5">
        <DialogTitle className="font-display text-4xl leading-none font-extrabold">{t("buyTitle")}</DialogTitle>
        <DialogDescription>
          {t("have", { credits: t("credits", { count: balance }), videos: Math.floor(balance / prices.standard) })}
        </DialogDescription>
      </DialogHeader>
      <PackOptions
        packs={packs}
        prices={prices}
        featured={featured}
        picked={pack.id}
        onPick={setPicked}
        name="dialog-pack"
      />
      <p className="flex items-center justify-between gap-3 rounded-lg bg-background px-4 py-3.5 text-sm">
        <span className="text-muted-foreground">{t("after")}</span>
        <span className="font-semibold text-primary-text">
          {t("afterValue", { credits: t("credits", { count: after }), videos: Math.floor(after / prices.standard) })}
        </span>
      </p>
      <Button size="lg" className="h-[52px] w-full" disabled={buying} onClick={pay}>
        {buying ? t("paying") : t("pay", { price })}
        {!buying && <LockKeyhole />}
      </Button>
      {error && (
        <p role="alert" className="-mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <PackBenefits size="sm" />
      <p className="-mt-2 text-xs text-faint">{t("secure")}</p>
    </DialogContent>
  );
}
