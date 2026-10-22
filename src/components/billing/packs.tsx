import { BadgeCheck, Infinity as InfinityIcon, RotateCcw, Share2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Shared by the pricing page (a server component), the home page, billing
// and the buy-credits dialog, so no hooks beyond translations and the
// formatter.

// The window peeper video's prices in credits, standard and Pro.
export type VideoPrices = { standard: number; pro: number };

export type Pack = { id: string; credits: number; amount: number; currency: string };

// What a pack buys, as the boards state it: Standard and Pro videos, the
// price of each Standard video, and what that saves against the smallest
// pack's price per video (0 for the smallest itself).
export function packFacts(pack: Pack, packs: readonly Pack[], prices: VideoPrices) {
  const perVideo = (each: Pack) => each.amount / Math.max(Math.floor(each.credits / prices.standard), 1);
  const base = Math.max(...packs.map(perVideo));
  return {
    videos: Math.floor(pack.credits / prices.standard),
    proVideos: Math.floor(pack.credits / prices.pro),
    perVideo: perVideo(pack),
    save: Math.round((1 - perVideo(pack) / base) * 100),
  };
}

// Amounts are in the currency's smallest unit; packs use two-decimal currencies.
export function useMoney() {
  const format = useFormatter();
  return (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });
}

// What a pack buys in window peeper videos: "3 videos", or "1 Pro video or 2
// videos" when Pro videos use up its credits exactly.
export function usePackBuys(prices: VideoPrices) {
  const t = useTranslations("Billing");
  return (credits: number) => {
    const videos = Math.floor(credits / prices.standard);
    const pro = credits / prices.pro;
    return Number.isInteger(pro) && pro > 0 ? t("buysPro", { pro, videos }) : t("buys", { videos });
  };
}

// The lamp tag beside the name of the pack recommended to start with
// (DEFAULT_PACK_ID).
export function Recommended({ className }: { className?: string }) {
  const t = useTranslations("Billing");
  return <PackBadge className={className}>{t("recommended")}</PackBadge>;
}

// A small mono tag in lamp, beside a pack's name.
export function PackBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[4px] bg-primary px-[7px] py-[3px] font-mono text-[9px] leading-none font-bold tracking-[0.11em] text-primary-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

// The packs as a radio group of rows: a radio, the name with the
// recommended tag, credits and price per video, then the price and what it
// saves (docs/DESIGN.md, Buy credits). The checked row is lit.
export function PackOptions({
  packs,
  prices,
  featured,
  picked,
  onPick,
  name,
  labelledBy,
  disabled = false,
}: {
  packs: readonly Pack[];
  prices: VideoPrices;
  featured: string;
  picked: string;
  onPick: (id: string) => void;
  // The radios' name, unique on the page.
  name: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("Billing");
  const money = useMoney();

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {packs.map((pack) => {
        const facts = packFacts(pack, packs, prices);
        return (
          <label
            key={pack.id}
            className="flex min-w-0 cursor-pointer items-center gap-4 rounded-lg border bg-background px-[18px] py-4 has-checked:border-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:px-[17px] has-checked:py-[15px] has-disabled:cursor-not-allowed has-disabled:opacity-50 [@media(hover:hover)]:hover:border-border-strong [@media(hover:hover)]:has-checked:hover:border-primary"
          >
            <input
              type="radio"
              name={name}
              value={pack.id}
              checked={pack.id === picked}
              disabled={disabled}
              onChange={() => onPick(pack.id)}
              className="peer size-5 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong checked:border-[6px] checked:border-primary checked:bg-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-base font-semibold">{t("packName", { videos: facts.videos })}</span>
                {pack.id === featured && <Recommended />}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {t("packMeta", {
                  credits: t("credits", { count: pack.credits }),
                  price: money(facts.perVideo, pack.currency),
                })}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-display text-[1.875rem] leading-none font-extrabold tabular-nums">
                {money(pack.amount, pack.currency)}
              </span>
              {facts.save > 0 && (
                <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-ok uppercase">
                  {t("save", { percent: facts.save })}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const BENEFITS = [
  { key: "watermark", icon: BadgeCheck },
  { key: "post", icon: Share2 },
  { key: "expire", icon: InfinityIcon },
  { key: "failed", icon: RotateCcw },
] as const;

// What every pack includes, with lamp icons: a row of four short notes
// (`size="sm"`), or larger ones in lamp-soft tiles.
export function PackBenefits({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const t = useTranslations("Billing");
  return (
    <ul className={cn("flex flex-wrap justify-between gap-x-5 gap-y-3", className)}>
      {BENEFITS.map(({ key, icon: Icon }) =>
        size === "sm" ? (
          <li key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon aria-hidden className="size-3.5 text-primary-text" />
            {t(`benefitsShort.${key}`)}
          </li>
        ) : (
          <li key={key} className="flex items-center gap-2.5 text-[15px] font-medium">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary-soft">
              <Icon className="size-[15px] text-primary-text" />
            </span>
            {t(`benefits.${key}`)}
          </li>
        ),
      )}
    </ul>
  );
}
