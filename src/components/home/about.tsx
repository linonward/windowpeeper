import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Link } from "@/i18n/navigation";
import { SectionHeading } from "./section-heading";

const SECTIONS = ["makes", "template", "trend", "filter", "music", "social", "quality"] as const;

const LINK = "font-medium text-primary-text underline underline-offset-4";

// The long answer under the steps: one topic per row, an h3 in the left
// third and muted paragraphs beside it, as on the guides (docs/DESIGN.md,
// Home). A topic links the guide that covers it in full.
export function About({ credits, proCredits }: { credits: number; proCredits: number }) {
  const t = useTranslations("Home.about");
  const page = (href: string) =>
    function PageLink(chunks: ReactNode) {
      return (
        <Link href={href} className={LINK}>
          {chunks}
        </Link>
      );
    };
  const generator = (chunks: ReactNode) => (
    <a href="#generator" className={LINK}>
      {chunks}
    </a>
  );
  const values = {
    credits,
    proCredits,
    generator,
    back: generator,
    howto: page("/how-to-make-window-peeper-video"),
    pricing: page("/pricing"),
  };

  return (
    <section aria-labelledby="about" className="flex flex-col gap-12 border-t py-20">
      {/* Smaller on phones, as the FAQ title. */}
      <SectionHeading eyebrow={t("eyebrow")} id="about" className="text-[clamp(1.5rem,8.2vw,1.875rem)] sm:text-4xl">
        {t("title")}
      </SectionHeading>
      <div className="flex flex-col">
        {SECTIONS.map((key, i) => (
          <div
            key={key}
            className={cn(
              "grid grid-cols-1 gap-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10",
              i > 0 && "border-t",
            )}
          >
            <h3 className="font-display text-lg font-semibold text-balance sm:text-xl">
              {t(`sections.${key}.title`)}
            </h3>
            <div className="flex max-w-[65ch] flex-col gap-4 leading-7 text-pretty text-muted-foreground">
              {(["1", "2"] as const).map((n) => (
                <p key={n}>{t.rich(`sections.${key}.text.${n}`, values)}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
