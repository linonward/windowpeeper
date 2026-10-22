import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VideoPrices } from "@/components/billing/packs";
import { type Pack, PackCards } from "@/components/pricing/pack-cards";
import { Link } from "@/i18n/navigation";
import { SectionHeading } from "./section-heading";

// The pricing page's packs on the home page (`#pricing`), with a link to
// the full price list.
export function Pricing({ packs, featured, prices }: { packs: readonly Pack[]; featured: string; prices: VideoPrices }) {
  const t = useTranslations("Home.pricing");
  const billing = useTranslations("Billing");

  return (
    <section aria-labelledby="pricing-title" id="pricing" className="flex scroll-mt-24 flex-col gap-10 border-t py-20">
      <div className="flex flex-col gap-4">
        <SectionHeading eyebrow={t("eyebrow")} id="pricing-title">
          {t("title")}
        </SectionHeading>
        <p className="max-w-[56ch] text-lg text-pretty text-muted-foreground">{t("body")}</p>
      </div>
      <PackCards packs={packs} featured={featured} prices={prices} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{billing("packsNote")}</p>
        <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-text">
          {t("more")}
          <ArrowRight aria-hidden className="icon-nudge size-4" />
        </Link>
      </div>
    </section>
  );
}
