import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const BEATS = ["1", "2", "3", "4", "5"] as const;
// The beats the progress bar has passed, lit in lamp.
const PLAYED = 3;

// The video's five beats on a timeline: a track with a lamp progress bar,
// then each beat's timecode, title and body. A list on phones.
export function ShotList() {
  const t = useTranslations("Home.shots");

  return (
    <section aria-labelledby="shots-title">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading eyebrow={t("eyebrow")} id="shots-title" aside={t("aside")}>
          {t("title")}
        </SectionHeading>
        <div>
          <div aria-hidden className="hidden h-1 rounded-sm bg-border lg:block">
            <div className="h-full w-[39%] rounded-sm bg-primary" />
          </div>
          <ol className="grid gap-6 lg:grid-cols-5 lg:pt-6">
            {BEATS.map((key, index) => (
              <li key={key} className="flex flex-col gap-2.5 max-lg:border-l-2 max-lg:pl-4 max-lg:[&:nth-child(-n+3)]:border-primary">
                <span
                  className={cn(
                    "font-mono text-[13px] font-semibold tracking-[0.08em]",
                    index < PLAYED ? "text-primary-text" : "text-faint",
                  )}
                >
                  {t(`items.${key}.time`)}
                </span>
                <h3 className="font-display text-[1.75rem] leading-tight font-extrabold">{t(`items.${key}.title`)}</h3>
                <p className="text-sm leading-normal text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
