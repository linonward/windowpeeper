import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PackBadge, Recommended, type VideoPrices } from "@/components/billing/packs";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type Pack = { id: string; credits: number; amount: number; currency: string };

const PERKS = ["1", "2"] as const;

// One card per credit pack, for the pricing page and the home page. A card
// reads as what the pack buys: its title is videos ("1 Pro video" when Pro
// videos use up its credits exactly, else "3 videos"), then the price, the
// other way to spend it or the price per video, and the credits as small
// print. Badges state facts: `featured`, the pack recommended to start with,
// and the best value, the lowest price per video. Buying happens on
// /billing, which asks a signed-out visitor to sign in first; each link
// names the pack, which billing marks. The links are nofollow: signed out,
// /billing redirects to the noindex sign-in page.
export function PackCards({ packs, featured, prices }: { packs: readonly Pack[]; featured: string; prices: VideoPrices }) {
  const billing = useTranslations("Billing");
  const format = useFormatter();
  // Amounts are in the currency's smallest unit; prices use two-decimal currencies.
  const money = (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });
  const videos = (pack: Pack) => Math.floor(pack.credits / prices.standard);
  const perVideo = (pack: Pack) => pack.amount / Math.max(videos(pack), 1);
  const best = packs.length > 1 ? [...packs].sort((a, b) => perVideo(a) - perVideo(b))[0].id : null;

  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {packs.map((pack) => {
        const recommended = pack.id === featured;
        const count = videos(pack);
        const pro = pack.credits / prices.pro;
        const byPro = Number.isInteger(pro) && pro > 0;
        const price = money(pack.amount, pack.currency);
        return (
          <li
            key={pack.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border bg-card p-5",
              recommended && "border-primary-text/40 bg-primary-text/5",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">
                {byPro ? billing("cardPro", { pro }) : billing("buys", { videos: count })}
              </h3>
              {recommended ? <Recommended /> : pack.id === best && <PackBadge>{billing("bestValue")}</PackBadge>}
            </div>
            <p className="font-display text-3xl font-bold text-foreground tabular-nums">{price}</p>
            <div className="flex flex-col gap-0.5 text-sm">
              {byPro ? (
                <p className="font-medium">{billing("orVideos", { videos: count })}</p>
              ) : (
                count > 1 && (
                  <p className="font-medium">{billing("perVideo", { price: money(perVideo(pack), pack.currency) })}</p>
                )
              )}
              <p className="text-muted-foreground">{billing("credits", { count: pack.credits })}</p>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {PERKS.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
                  {billing(`perks.${key}`)}
                </li>
              ))}
            </ul>
            <Link
              href={`/billing?pack=${pack.id}`}
              rel="nofollow"
              aria-label={billing("buyLabel", { credits: billing("credits", { count: pack.credits }), price })}
              className={cn(buttonVariants({ variant: recommended ? "default" : "outline", size: "lg" }), "mt-auto")}
            >
              {billing("buyFor", { price })}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
