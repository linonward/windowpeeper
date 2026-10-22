import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { faqPage, jsonLd } from "@/lib/seo";

const QUESTIONS = ["1", "2", "3", "4", "5", "6", "7"] as const;
// Open on load, as the boards show them.
const OPEN = ["1", "2"];

// The title on the left; ruled rows on the right, each a question and a plus
// that turns when open (docs/DESIGN.md, FAQ accordion). The answers state the
// smallest pack's price and the photo size from the server config, which the
// page passes in. The same questions and answers are FAQPage structured data
// for search engines.
export function Faq({ price, size }: { price: string; size: number }) {
  const t = useTranslations("Home.faq");
  const locale = useLocale();
  const values = { price, size };
  const data = faqPage(
    locale,
    QUESTIONS.map((key) => ({ question: t(`items.${key}.title`), answer: t(`items.${key}.body`, values) })),
  );

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-20 lg:py-24">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 id="faq-title" className="font-display text-[clamp(2.25rem,9vw,3rem)] leading-none font-extrabold text-balance">
            {t("title")}
          </h2>
        </div>
        <div>
          {QUESTIONS.map((key) => (
            <details key={key} open={OPEN.includes(key)} className="group border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[22px] [&::-webkit-details-marker]:hidden">
                <span className="text-lg font-semibold [@media(hover:hover)]:group-hover:text-primary-text">
                  {t(`items.${key}.title`)}
                </span>
                <Plus className="icon-turn size-5 shrink-0 text-muted-foreground group-open:text-primary-text" />
              </summary>
              <p className="-mt-3 max-w-[65ch] pb-[22px] leading-[1.55] text-pretty text-muted-foreground">
                {t(`items.${key}.body`, values)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
