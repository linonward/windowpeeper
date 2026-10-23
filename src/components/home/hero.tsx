import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { RecBadge } from "./rec-badge";
import { Timecode } from "./timecode";
import { Viewfinder } from "./viewfinder";
import { WindowPeeperTryout, type WindowPeeperTryoutProps } from "./window-peeper-tryout";

// The first screen: the REC badge, the headline and the generator on the
// left, the example clip in a viewfinder on the right, which focuses on load
// while its timecode counts up. Phones show a small
// before/after strip above the generator, and the clip under it.
// A real window peeper video from public/: the clip and its poster.
export type HomeExample = { sample: string; poster: string };

export function Hero({ tryout, example }: { tryout: WindowPeeperTryoutProps; example: HomeExample }) {
  const t = useTranslations("Home.hero");

  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_80%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
      />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 pt-6 pb-14 sm:px-8 sm:pt-9 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-[72px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <RecBadge className="border bg-card max-sm:text-[10px]">{t("badge")}</RecBadge>
          {/* The h1 leads with the query the page targets, then the tagline. */}
          <h1 className="flex flex-col gap-2.5 font-display hyphens-auto [overflow-wrap:break-word] text-balance">
            <span className="text-[clamp(2.5rem,11.4vw,3.875rem)] leading-none font-black">{t("heading")}</span>{" "}
            {/* Search engines and screen readers read the h1 as one line. */}
            <span className="sr-only">—</span>{" "}
            <span className="text-[clamp(1.5rem,6.5vw,2.25rem)] leading-tight font-bold text-primary-text">
              {t("title")}
            </span>
          </h1>
          <p className="text-[17px] leading-[1.55] text-pretty text-muted-foreground">{t("body")}</p>
          <PhoneStrip />
          <WindowPeeperTryout {...tryout} />
        </div>
        <figure className="mx-auto flex w-full max-w-[340px] flex-col gap-3">
          <Viewfinder
            src={example.poster}
            video={example.sample}
            alt={t("clip.description")}
            rec={<Timecode start={t("clip.rec")} />}
            caption={t("clip.caption")}
            sizes="340px"
            priority
            className="focus-in aspect-[340/604] w-full"
          />
          <figcaption className="text-xs text-faint">{t("clip.note")}</figcaption>
        </figure>
      </div>
    </section>
  );
}

// On phones, in place of the clip: the photo, an arrow and two frames of
// the video it makes.
function PhoneStrip() {
  const t = useTranslations("Home.beforeAfter");
  const frames = ["/landing/beat-bite.jpg", "/landing/beat-curtain.jpg"];
  return (
    <div className="flex items-center gap-2.5 lg:hidden" aria-hidden>
      <div className="flex flex-col gap-1.5">
        <span className="relative block h-[100px] w-[76px] overflow-hidden rounded-sm border border-border-strong">
          <Image src="/landing/before.jpg" alt="" fill sizes="76px" className="object-cover" />
        </span>
        <span className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase">{t("photo")}</span>
      </div>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
        <ArrowRight className="size-3.5 text-primary-foreground" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex gap-1.5">
          {frames.map((src) => (
            <span key={src} className="relative block h-[132px] w-[74px] overflow-hidden rounded-sm border">
              <Image src={src} alt="" fill sizes="74px" className="object-cover" />
            </span>
          ))}
        </span>
        <span className="truncate font-mono text-[9px] tracking-[0.1em] text-primary-text uppercase">{t("short")}</span>
      </div>
    </div>
  );
}
