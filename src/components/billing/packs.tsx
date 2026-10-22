import { useTranslations } from "next-intl";

// Shared by the pricing page (a server component) and billing, so no hooks
// beyond translations.

// The window peeper video's prices in credits, standard and Pro.
export type VideoPrices = { standard: number; pro: number };

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

// The label beside the title of the pack recommended to start with
// (DEFAULT_PACK_ID).
export function Recommended() {
  const t = useTranslations("Billing");
  return <PackBadge>{t("recommended")}</PackBadge>;
}

// A label beside a card's title. It is shorter than the title's line, so
// the card keeps its height.
export function PackBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 shrink-0 rounded-full bg-primary-text/12 px-2.5 py-0.5 text-xs font-semibold text-primary-text">
      {children}
    </span>
  );
}
