"use client";

import { LockKeyhole } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useCreditBalance } from "@/components/dashboard/credits";
import { CreditTransactions, type Transaction } from "@/components/credits/credit-transactions";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useAwaitCredits } from "./await-credits";
import { type Pack, PackBenefits, PackOptions, useMoney, type VideoPrices } from "./packs";
import { redirectFrom } from "./redirect";

type Order = {
  id: string;
  credits: number;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "expired" | "failed";
  createdAt: Date;
};

export type BillingProps = {
  balance: number;
  packs: readonly Pack[];
  // The pack recommended to start with, unless the pricing page chose one.
  featured: string;
  // The window peeper video's prices, to say what each pack buys.
  prices: VideoPrices;
  orders: Order[];
  // The newest credit ledger rows.
  transactions: Transaction[];
  // False when no payment provider is configured.
  enabled: boolean;
  // Set when the provider sends the user back from checkout.
  checkout?: "success" | "cancel";
  // The pack ID chosen on the pricing page, if any.
  selected?: string;
  // The subscription section, shown above the packs to subscribers.
  subscription?: React.ReactNode;
};

export function Billing({
  balance: initialBalance,
  packs,
  featured,
  prices,
  orders,
  transactions,
  enabled,
  checkout,
  selected,
  subscription,
}: BillingProps) {
  const { balance } = useCreditBalance(initialBalance);
  const t = useTranslations("Billing");
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  // A pack chosen on the pricing page starts picked; else the recommended one.
  const chosen = packs.some((pack) => pack.id === selected) ? selected : undefined;
  const [picked, setPicked] = useState(chosen ?? featured);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState(false);
  const credited = useAwaitCredits(checkout === "success", balance);
  const pack = packs.find((each) => each.id === picked) ?? packs[0];
  const pay = useRef<HTMLButtonElement>(null);

  // Back from the pricing page with a pack: its pay button takes focus, which
  // scrolls it into view.
  useEffect(() => {
    if (chosen) pay.current?.focus();
  }, [chosen]);

  // Amounts are in the currency's smallest unit; packs use two-decimal currencies.
  const price = (amount: number, currency: string) => money(amount, currency);

  async function buy() {
    track("checkout_clicked", { surface: "billing", pack_id: pack.id });
    setBuying(true);
    setError(false);
    if ((await redirectFrom("/api/payment/checkout", { packId: pack.id, locale })) === null) return;
    setBuying(false);
    setError(true);
  }

  return (
    <div className="flex flex-col gap-10">
      {checkout && (
        <p role="status" className="rounded-xl border bg-card px-5 py-4 text-pretty">
          {t(checkout === "cancel" ? "canceled" : credited ? "credited" : "success")}
        </p>
      )}

      <section className="flex w-fit min-w-60 flex-col gap-1 rounded-lg border bg-card px-5 py-4">
        <h2 className="font-mono text-[10px] tracking-[0.15em] text-faint uppercase">{t("balance")}</h2>
        <p className="font-display text-4xl leading-none font-extrabold tabular-nums">{t("credits", { count: balance })}</p>
      </section>

      {subscription}

      {pack && (
        <section aria-labelledby="billing-buy" className="flex max-w-[620px] flex-col gap-5">
          <h2 id="billing-buy" className="font-display text-[1.75rem] leading-none font-extrabold">
            {t("buyTitle")}
          </h2>
          {!enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
          <PackOptions
            packs={packs}
            prices={prices}
            featured={featured}
            picked={pack.id}
            onPick={setPicked}
            name="billing-pack"
            labelledBy="billing-buy"
            disabled={!enabled}
          />
          <Button
            ref={pay}
            size="lg"
            className="h-[52px] w-full"
            disabled={!enabled || buying}
            aria-label={t("buyLabel", { credits: t("credits", { count: pack.credits }), price: price(pack.amount, pack.currency) })}
            onClick={buy}
          >
            {buying ? t("paying") : t("pay", { price: price(pack.amount, pack.currency) })}
            {!buying && <LockKeyhole />}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t("checkoutError")}
            </p>
          )}
          <PackBenefits size="sm" />
          <p className="text-xs text-faint">{t("secure")}</p>
        </section>
      )}

      <CreditTransactions transactions={transactions} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.75rem] leading-none font-extrabold">{t("ordersTitle")}</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("ordersTitle")}</caption>
              <thead className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
                <tr>
                  <th className="px-5 py-3 font-normal">{t("date")}</th>
                  <th className="px-5 py-3 font-normal">{t("pack")}</th>
                  <th className="px-5 py-3 font-normal">{t("amount")}</th>
                  <th className="px-5 py-3 font-normal">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      {format.dateTime(order.createdAt, { dateStyle: "medium" })}
                    </td>
                    <td className="px-5 py-3">{t("credits", { count: order.credits })}</td>
                    <td className="px-5 py-3">{price(order.amount, order.currency)}</td>
                    <td className="px-5 py-3">{t(`statuses.${order.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

