import { useTranslations } from "next-intl";
import { InView } from "./in-view";
import { SectionHeading } from "./section-heading";

const BEATS = ["1", "2", "3", "4", "5"] as const;

// The video's five beats on a timeline: a track with a lamp playhead, then
// each beat's timecode, title and body. A list on phones. Once half of it is
// in view, the playhead runs the 14 seconds and lights each beat it reaches
// (globals.css, Home motion); it ends on the full bar with every beat lit.
export function ShotList() {
  const t = useTranslations("Home.shots");

  return (
    <section aria-labelledby="shots-title">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading eyebrow={t("eyebrow")} id="shots-title" aside={t("aside")}>
          {t("title")}
        </SectionHeading>
        <InView motion="playhead" threshold={0.5}>
          <div aria-hidden className="hidden h-1 rounded-sm bg-border lg:block">
            <div className="playhead h-full w-full rounded-sm bg-primary" />
          </div>
          <ol className="grid gap-6 lg:grid-cols-5 lg:pt-6">
            {BEATS.map((key, index) => (
              <li
                key={key}
                style={{ "--i": index } as React.CSSProperties}
                className="beat flex flex-col gap-2.5 max-lg:border-l-2 max-lg:border-primary max-lg:pl-4"
              >
                <span className="beat-time font-mono text-[13px] font-semibold tracking-[0.08em] text-primary-text">
                  {t(`items.${key}.time`)}
                </span>
                <h3 className="beat-title font-display text-[1.75rem] leading-tight font-extrabold">{t(`items.${key}.title`)}</h3>
                <p className="text-sm leading-normal text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </InView>
      </div>
    </section>
  );
}
