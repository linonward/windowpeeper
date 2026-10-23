import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { RecBadge } from "./rec-badge";
import { InView } from "./in-view";
import { SectionHeading } from "./section-heading";

const BEATS = [
  { key: "bite", time: "00:03", src: "/landing/beat-bite.jpg" },
  { key: "freeze", time: "00:06", src: "/landing/beat-freeze.jpg" },
  { key: "curtain", time: "00:12", src: "/landing/beat-curtain.jpg" },
] as const;

// The photo, an arrow with the wait, and three frames of the video it
// makes. Hidden on phones, where the hero shows a smaller strip. Settles in
// once in view (globals.css, Home motion).
export function BeforeAfter() {
  const t = useTranslations("Home.beforeAfter");

  return (
    <section aria-labelledby="before-after" className="hidden border-t lg:block">
      <InView motion="settle" threshold={0.15} className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-8 py-24">
        <SectionHeading eyebrow={t("eyebrow")} id="before-after" aside={t("aside")}>
          {t("title")}
        </SectionHeading>
        <div className="flex items-center gap-7">
          <figure className="flex shrink-0 flex-col gap-3">
            <span className="settle-media relative block h-[290px] w-[220px] overflow-hidden rounded-lg border border-border-strong">
              <Image src="/landing/before.jpg" alt={t("photoAlt")} fill sizes="220px" className="object-cover" />
            </span>
            <figcaption className="settle-text font-mono text-[11px] tracking-[0.09em] text-muted-foreground uppercase">
              {t("photo")}
            </figcaption>
          </figure>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
            <span aria-hidden className="settle-media flex size-[52px] items-center justify-center rounded-full bg-primary">
              <ArrowRight className="size-6 text-primary-foreground" />
            </span>
            <span className="settle-text font-mono text-[11px] tracking-[0.09em] text-muted-foreground uppercase">{t("time")}</span>
          </div>
          <figure className="flex shrink-0 flex-col gap-3">
            <ul className="flex gap-3">
              {BEATS.map(({ key, time, src }) => (
                <li
                  key={key}
                  className="settle-media relative isolate flex h-[330px] w-[186px] flex-col justify-between overflow-hidden rounded-lg border bg-muted p-2.5"
                >
                  <Image
                    src={src}
                    alt={t("beatAlt", { beat: t(`beats.${key}`) })}
                    fill
                    sizes="186px"
                    className="-z-10 object-cover"
                  />
                  <RecBadge className="text-[10px]">{time}</RecBadge>
                  <span className="font-mono text-[10px] tracking-[0.15em] uppercase">{t(`beats.${key}`)}</span>
                </li>
              ))}
            </ul>
            <figcaption className="settle-text font-mono text-[11px] tracking-[0.09em] text-primary-text uppercase">
              {t("label")}
            </figcaption>
          </figure>
        </div>
        <p className="settle-text text-xs text-faint">{t("note")}</p>
      </InView>
    </section>
  );
}
