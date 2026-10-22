import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { SiteAccount } from "@/app/_lib/site-account";
import { Viewfinder } from "@/components/home/viewfinder";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { sceneImage, SCENES } from "@/lib/photo-effects";
import { cn } from "@/lib/utils";

// The first four scenes, as cards that open the generator with the scene
// picked (?scene=, read by the generator).
const SHOWN = SCENES.slice(0, 4);

// docs/DESIGN.md, 404: a dark window in the viewfinder (large screens),
// the title, the generator and home, then scenes to start from.
export default function NotFound() {
  const t = useTranslations("NotFound");
  const ts = useTranslations("PhotoEffects.scenes");
  const th = useTranslations("Home.scenes");

  return (
    <>
      <SiteHeader account={<SiteAccount />} />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-5 pt-12 pb-20 sm:px-8 lg:gap-20 lg:pt-16 lg:pb-24"
      >
        <div className="flex items-center gap-20">
          <div className="flex flex-1 flex-col gap-5">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="font-display text-5xl leading-[0.95] font-black text-balance lg:text-7xl">{t("title")}</h1>
            <p className="max-w-[640px] text-lg leading-normal text-pretty text-muted-foreground">{t("body")}</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Link href="/#generator" className={cn(buttonVariants({ size: "lg" }), "max-sm:w-full")}>
                {t("cta")}
                <ArrowRight className="icon-nudge" />
              </Link>
              <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "max-sm:w-full")}>
                {t("home")}
              </Link>
            </div>
          </div>
          <Viewfinder
            src={sceneImage("couple")}
            alt={t("still")}
            rec={t("rec")}
            caption={t("caption")}
            sizes="270px"
            // The lights are off.
            className="hidden aspect-[9/16] w-[270px] shrink-0 lg:block [&>img]:brightness-[0.3]"
          />
        </div>

        <section aria-labelledby="not-found-scenes" className="flex flex-col gap-5">
          <h2 id="not-found-scenes" className="font-display text-[1.625rem] leading-none font-extrabold lg:text-[2rem]">
            {t("scenes")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
            {SHOWN.map((scene) => (
              <li key={scene}>
                <Link
                  href={{ pathname: "/", query: { scene }, hash: "generator" }}
                  aria-label={th("useLabel", { scene: ts(`${scene}.name`) })}
                  className="group flex flex-col gap-3"
                >
                  <span className="relative isolate flex aspect-[5/7] flex-col justify-end overflow-hidden rounded-lg border p-2.5 transition-colors [@media(hover:hover)]:group-hover:border-primary/60">
                    <Image src={sceneImage(scene)} alt="" fill sizes="(min-width: 1024px) 250px, 50vw" className="-z-20 object-cover" />
                    <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-background/80" />
                    <span className="font-mono text-[11px] tracking-[0.11em]">{ts(`${scene}.time`)}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold lg:text-base">{ts(`${scene}.name`)}</span>
                    <span className="text-[13px] text-muted-foreground">{th("use")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
