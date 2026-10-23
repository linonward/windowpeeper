import { ArrowUp, LayoutGrid } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { GUIDES } from "@/lib/guides";
import { type Scene, sceneImage, SCENES } from "@/lib/photo-effects";
import { cn } from "@/lib/utils";
import { InView } from "./in-view";
import { RecBadge } from "./rec-badge";
import { SceneButton } from "./scene-button";
import { SectionHeading } from "./section-heading";

const [ORIGINAL, ...OTHERS] = SCENES;

// The six windows: the original large on the left, the other five and a
// link to the guide in a grid on the right. "Use this scene" picks it in
// the generator. Once 30% of the grid is in view, the windows light up in
// reading order, the original first (globals.css, Home motion).
export function Scenes() {
  const t = useTranslations("Home.scenes");
  const ts = useTranslations("PhotoEffects.scenes");

  return (
    <section id="scenes" aria-labelledby="scenes-title" className="scroll-mt-16 border-y bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20 sm:px-8 lg:py-24">
        <SectionHeading eyebrow={t("eyebrow")} id="scenes-title" aside={t("aside")}>
          {t("title")}
        </SectionHeading>
        <InView
          motion="windows"
          threshold={0.3}
          className="grid grid-cols-1 gap-4 lg:h-[580px] lg:grid-cols-[420px_minmax(0,1fr)]"
        >
          <article
            style={order(0)}
            className="scene-window relative isolate flex min-h-[460px] flex-col justify-between overflow-hidden rounded-xl border-2 border-primary p-5"
          >
            <SceneStill scene={ORIGINAL} sizes="(min-width: 1024px) 420px, 100vw" />
            <div className="window-text flex items-center justify-between gap-3">
              <RecBadge>{t("rec")}</RecBadge>
              <span className="rounded-[4px] bg-primary px-[9px] py-[5px] font-mono text-[10px] leading-none font-bold tracking-[0.1em] text-primary-foreground uppercase">
                {t("original")}
              </span>
            </div>
            <div className="window-text flex flex-col gap-2">
              <h3 className="font-display text-[2.5rem] leading-none font-extrabold">{ts(`${ORIGINAL}.name`)}</h3>
              <p className="text-sm leading-normal text-muted-foreground">{ts(`${ORIGINAL}.note`)}</p>
              <SceneButton
                scene={ORIGINAL}
                aria-label={t("useLabel", { scene: ts(`${ORIGINAL}.name`) })}
                className={cn(buttonVariants({ size: "lg" }), "mt-2 w-full")}
              >
                {t("use")}
                <ArrowUp />
              </SceneButton>
            </div>
          </article>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:grid-rows-2">
            {OTHERS.map((scene, index) => (
              <li
                key={scene}
                style={order(index + 1)}
                className="scene-window relative isolate flex min-h-[220px] flex-col justify-between overflow-hidden rounded-lg border p-3.5"
              >
                <SceneStill scene={scene} sizes="(min-width: 1024px) 210px, 50vw" />
                <span className="window-text font-mono text-[10px] tracking-[0.1em]">{ts(`${scene}.time`)}</span>
                <div className="window-text flex flex-col gap-1.5">
                  <h3 className="font-semibold">{ts(`${scene}.name`)}</h3>
                  <SceneButton
                    scene={scene}
                    aria-label={t("useLabel", { scene: ts(`${scene}.name`) })}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-text underline-offset-4 [@media(hover:hover)]:hover:underline"
                  >
                    {t("use")}
                    <ArrowUp aria-hidden className="size-3.5" />
                  </SceneButton>
                </div>
              </li>
            ))}
            <li>
              <Link
                href={`/${GUIDES[0]}`}
                className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-background p-4 text-center transition-colors [@media(hover:hover)]:hover:border-primary/60"
              >
                <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-primary-soft">
                  <LayoutGrid className="size-5 text-primary-text" />
                </span>
                <span className="text-[15px] font-semibold">{t("all")}</span>
                <span className="text-xs text-muted-foreground">{t("allNote")}</span>
              </Link>
            </li>
          </ul>
        </InView>
      </div>
    </section>
  );
}

// A window's place in the order they light up in.
function order(index: number) {
  return { "--i": index } as React.CSSProperties;
}

// A scene's placeholder still behind a card, shaded toward the bottom, and
// the dark that hides it until its window lights up.
function SceneStill({ scene, sizes }: { scene: Scene; sizes: string }) {
  return (
    <>
      <Image src={sceneImage(scene)} alt="" fill sizes={sizes} className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-background/10 via-transparent to-background/90" />
      <div aria-hidden className="window-dark absolute inset-0 -z-10 bg-black opacity-0" />
    </>
  );
}
