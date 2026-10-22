import { Plus } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";
import { faqPage, jsonLd } from "@/lib/seo";
import { SectionHeading } from "./section-heading";

const QUESTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

type Pack = { credits: number; amount: number; currency: string };

// Numbered rows; an open row inverts its index and toggle (docs/DESIGN.md, FAQ accordion).
// The answers state the video prices, the packs and the photo size from the
// server config, which the page passes in. The same questions and answers,
// as plain text, are FAQPage structured data for search engines.
export function Faq({
  credits,
  proCredits,
  packs,
  size,
}: {
  credits: number;
  proCredits: number;
  packs: readonly Pack[];
  size: number;
}) {
  const t = useTranslations("Home.faq");
  const format = useFormatter();
  const locale = useLocale();
  // "10 credits for $4.99, 20 credits for $7.99, and 30 credits for $11.99".
  // Amounts are in the currency's smallest unit; packs use two-decimal currencies.
  const packList = format.list(
    packs.map((pack) =>
      t("pack", {
        credits: pack.credits,
        price: format.number(pack.amount / 100, { style: "currency", currency: pack.currency.toUpperCase() }),
      }),
    ),
  );

  const values = { credits, proCredits, packs: packList, size };
  // The answers' links as their text.
  const data = faqPage(
    locale,
    QUESTIONS.map((key) => ({
      question: t(`items.${key}.title`),
      answer: t.markup(`items.${key}.body`, {
        ...values,
        pricing: (chunks) => chunks,
        email: () => projectConfig.supportEmail,
      }),
    })),
  );

  return (
    <section
      aria-labelledby="faq"
      className="grid grid-cols-1 gap-10 border-t py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      {/* "Rumpelstiltskin" can't wrap: smaller on phones and in the narrow column. */}
      <SectionHeading
        eyebrow={t("eyebrow")}
        id="faq"
        className="text-[clamp(1.5rem,8.2vw,1.875rem)] lg:text-[1.75rem]"
      >
        {t("title")}
      </SectionHeading>
      <div className="border-b">
        {QUESTIONS.map((key) => (
          <details key={key} className="group border-t open:bg-muted/40">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-2 py-4 sm:px-4 [&::-webkit-details-marker]:hidden">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold tabular-nums group-open:border-foreground group-open:bg-foreground group-open:text-background">
                {key.padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 font-display text-base font-bold sm:text-lg [@media(hover:hover)]:group-hover:text-primary-text">
                {t(`items.${key}.title`)}
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border group-open:border-foreground group-open:bg-foreground group-open:text-background">
                <Plus className="icon-turn size-4" />
              </span>
            </summary>
            <p className="max-w-[65ch] px-2 pb-6 pl-14 leading-7 text-pretty text-muted-foreground sm:px-4 sm:pl-16">
              {t.rich(`items.${key}.body`, {
                ...values,
                pricing: (chunks) => (
                  <Link href="/pricing" className="font-medium text-primary-text underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
                email: () => (
                  <a
                    href={`mailto:${projectConfig.supportEmail}`}
                    className="font-medium text-primary-text underline underline-offset-4"
                  >
                    {projectConfig.supportEmail}
                  </a>
                ),
              })}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
