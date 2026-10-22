import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { VideoPrices } from "@/components/billing/packs";
import { Link } from "@/i18n/navigation";
import { type Pack, PackCards } from "./pack-cards";

const INCLUDES = ["1", "2", "3", "4"] as const;
const QUESTIONS = ["preview", "quality", "expire", "monthly", "failed", "refund", "watermark", "sound"] as const;

// The public price list, laid out like the price lists people compare it
// with: the meme and the lowest price in the h1, the packs titled by the
// videos they buy, what every pack includes, then the questions buyers ask.
// One-time credit packs only, no subscription. `featured` is the pack
// recommended to start with.
export function Pricing({ packs, featured, prices }: { packs: readonly Pack[]; featured: string; prices: VideoPrices }) {
  const t = useTranslations("Pricing");
  const format = useFormatter();
  const [cheapest] = [...packs].sort((a, b) => a.amount - b.amount);
  const price = format.number(cheapest.amount / 100, { style: "currency", currency: cheapest.currency.toUpperCase() });

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 py-12 sm:px-8 sm:py-16">
      <header className="flex flex-col items-center gap-4 text-center">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display-tight max-w-3xl font-display text-3xl font-bold text-balance sm:text-5xl">
          {t("title", { price })}
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("description", { price })}</p>
      </header>

      <section aria-labelledby="pricing-packs" className="flex flex-col gap-5">
        <h2 id="pricing-packs" className="sr-only">
          {t("packsTitle")}
        </h2>
        <PackCards packs={packs} featured={featured} prices={prices} />
        <p className="text-center text-sm text-muted-foreground">
          {t("spend", { standard: prices.standard, pro: prices.pro })}
        </p>
        <ul aria-label={t("includesLabel")} className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {INCLUDES.map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm font-medium">
              <Check aria-hidden className="size-4 text-primary-text" />
              {t(`includes.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pricing-faq" className="flex flex-col gap-4">
        <h2 id="pricing-faq" className="display-tight font-display text-2xl font-bold">
          {t("faqTitle")}
        </h2>
        <dl className="border-b">
          {QUESTIONS.map((key) => (
            <div key={key} className="flex flex-col gap-2 border-t py-5">
              <dt className="font-semibold">{t(`faq.${key}.title`)}</dt>
              <dd className="max-w-[65ch] leading-7 text-pretty text-muted-foreground">
                {t.rich(`faq.${key}.body`, {
                  standard: prices.standard,
                  pro: prices.pro,
                  refund: (chunks) => <BodyLink href="/refund">{chunks}</BodyLink>,
                  terms: (chunks) => <BodyLink href="/terms">{chunks}</BodyLink>,
                })}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function BodyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary-text underline underline-offset-4">
      {children}
    </Link>
  );
}
