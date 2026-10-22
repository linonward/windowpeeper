import { Check, Infinity as InfinityIcon, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { BuyPack, CheckoutNotice } from "@/components/billing/buy-pack";
import { type Pack, packFacts, Recommended, useMoney, type VideoPrices } from "@/components/billing/packs";
import { cn } from "@/lib/utils";

const TRUST = [
  { key: "failed", icon: RotateCcw },
  { key: "expire", icon: InfinityIcon },
  { key: "secure", icon: ShieldCheck },
] as const;

// The public price list (docs/DESIGN.md, Pricing): a centered head over a
// lamp glow, one card per pack, what each quality costs, and three
// promises. One-time credit packs only, no subscription. Each card buys its
// pack here; checkout comes back to this page. `featured` is the
// pack recommended to start with; on phones it comes first.
export function Pricing({ packs, featured, prices }: { packs: readonly Pack[]; featured: string; prices: VideoPrices }) {
  const t = useTranslations("Pricing");

  return (
    <main id="main-content" className="w-full flex-1">
      <header className="bg-linear-to-b from-primary/10 to-transparent">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 pt-14 pb-10 sm:px-8 sm:items-center sm:pt-[88px] sm:pb-12 sm:text-center">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="font-display text-[clamp(2.75rem,12vw,4.5rem)] leading-none font-black text-balance">
            {t("title")}
          </h1>
          <p className="max-w-[600px] text-[17px] leading-normal text-pretty text-muted-foreground">
            {t("description", { standard: prices.standard, pro: prices.pro })}
          </p>
        </div>
      </header>

      <section aria-labelledby="pricing-packs" className="mx-auto w-full max-w-6xl px-5 pt-4 pb-8 sm:px-8">
        <h2 id="pricing-packs" className="sr-only">
          {t("packsTitle")}
        </h2>
        <CheckoutNotice className="mb-5" />
        <PlanCards packs={packs} featured={featured} prices={prices} />
      </section>

      <section aria-labelledby="pricing-cost" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-14 sm:px-8">
        <h2 id="pricing-cost" className="font-display text-[2.5rem] leading-none font-extrabold">
          {t("cost.title")}
        </h2>
        <CostTable prices={prices} />
      </section>

      <ul className="mx-auto grid w-full max-w-6xl gap-5 px-5 pt-2 pb-24 sm:px-8 lg:grid-cols-3">
        {TRUST.map(({ key, icon: Icon }) => (
          <li key={key} className="flex gap-3.5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-soft">
              <Icon className="size-5 text-primary-text" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{t(`trust.${key}.title`)}</span>
              <span className="text-sm leading-normal text-pretty text-muted-foreground">{t(`trust.${key}.body`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

// One card per pack: its name, the price and credits, who it's for, what it
// buys, and a button that buys the pack.
function PlanCards({ packs, featured, prices }: { packs: readonly Pack[]; featured: string; prices: VideoPrices }) {
  const t = useTranslations("Pricing");
  const billing = useTranslations("Billing");
  const money = useMoney();

  return (
    <ul className="grid gap-5 lg:grid-cols-3">
      {packs.map((pack) => {
        const facts = packFacts(pack, packs, prices);
        const lit = pack.id === featured;
        const price = money(pack.amount, pack.currency);
        const credits = billing("credits", { count: pack.credits });
        const features =
          facts.videos === 1
            ? [t("features.one"), t("features.scenes"), t("features.download")]
            : [
                t("features.videos", { videos: facts.videos, pro: facts.proVideos }),
                t("features.perVideo", { price: money(facts.perVideo, pack.currency), percent: facts.save }),
                t("features.expire"),
              ];
        return (
          <li
            key={pack.id}
            className={cn(
              "flex flex-col gap-5 rounded-xl border bg-card p-6",
              lit && "border-2 border-primary bg-primary-soft p-[23px] max-lg:order-first",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className={cn("font-mono text-xs tracking-[0.12em] uppercase", lit ? "text-primary-text" : "text-muted-foreground")}>
                {billing("packShort", { videos: facts.videos })}
              </h3>
              {lit && <Recommended className="px-2 py-1 text-[10px]" />}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-display text-[3.75rem] leading-none font-black tabular-nums">{price}</span>
              <span className="text-sm text-muted-foreground">{credits}</span>
            </div>
            <p className="text-sm font-semibold">{t(`subs.${pack.id as "small" | "medium" | "large"}`)}</p>
            <ul className="flex flex-col gap-2.5 border-t pt-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check aria-hidden className="size-4 shrink-0 text-primary-text" />
                  {feature}
                </li>
              ))}
            </ul>
            <BuyPack
              pack={pack}
              returnTo="pricing"
              aria-label={billing("buyLabel", { credits, price })}
              variant={lit ? "default" : "outline"}
              size="lg"
              className="mt-auto w-full"
            >
              {t("buy", { videos: facts.videos })}
            </BuyPack>
          </li>
        );
      })}
    </ul>
  );
}

// Each quality's resolution, wait and credits.
function CostTable({ prices }: { prices: VideoPrices }) {
  const t = useTranslations("Pricing.cost");
  const rows = [
    { key: "standard", credits: prices.standard },
    { key: "pro", credits: prices.pro },
  ] as const;
  const head = "px-4 py-4 text-left font-mono text-[11px] font-normal tracking-[0.12em] text-faint uppercase sm:px-6";
  const cell = "px-4 py-4 text-[15px] sm:px-6";

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full">
        <thead className="border-b bg-card">
          <tr>
            <th className={head}>{t("quality")}</th>
            <th className={head}>{t("resolution")}</th>
            <th className={cn(head, "max-sm:hidden")}>{t("ready")}</th>
            <th className={cn(head, "text-right")}>{t("credits")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ key, credits }) => (
            <tr key={key}>
              <th scope="row" className={cn(cell, "text-left font-normal")}>
                {t(`${key}.name`)}
              </th>
              <td className={cell}>{t(`${key}.resolution`)}</td>
              <td className={cn(cell, "max-sm:hidden")}>{t(`${key}.time`)}</td>
              <td className={cn(cell, "text-right font-mono font-semibold text-primary-text")}>{credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
