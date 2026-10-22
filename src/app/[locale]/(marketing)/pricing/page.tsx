import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { videoPrices } from "@/app/_lib/home-facts";
import { Pricing } from "@/components/pricing/pricing";
import { languageAlternates } from "@/lib/seo";
import { CREDIT_PACKS, DEFAULT_PACK_ID } from "@/server/payment/packs";
import { localePath, type Locale } from "@/i18n/routing";

// The price list shows packs only: offeredPlans() offers no subscription.
export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Pricing");
  const format = await getFormatter();
  // The cheapest pack buys one video.
  const [{ amount, currency }] = [...CREDIT_PACKS].sort((a, b) => a.amount - b.amount);
  const price = format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });
  return {
    title: t("metaTitle"),
    description: t("metaDescription", { price }),
    alternates: { canonical: localePath(locale as Locale, "/pricing"), languages: languageAlternates("/pricing") },
  };
}

export default function Page() {
  return <Pricing packs={CREDIT_PACKS} featured={DEFAULT_PACK_ID} prices={videoPrices()} />;
}
