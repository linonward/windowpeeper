import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { InView } from "./in-view";
import { RecBadge } from "./rec-badge";

// docs/DESIGN.md, Final CTA: a lamp glow from the top, the REC stamp, a big
// title and one button up to the generator in the hero, or, from another
// page, to `href` (the home page's generator). Settles in once in view
// (globals.css, Home motion).
export function Cta({ href }: { href?: string }) {
  const t = useTranslations("Home.cta");

  return (
    <section
      aria-labelledby="cta"
      className="relative isolate overflow-hidden border-t bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent)]"
    >
      <InView
        motion="settle"
        threshold={0.15}
        className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-24 text-center sm:px-8 lg:py-[120px]"
      >
        <RecBadge className="settle-text bg-card">{t("rec")}</RecBadge>
        <h2 id="cta" className="settle-text font-display text-[clamp(3rem,13vw,5.5rem)] leading-none font-black text-balance">
          {t("title")}
        </h2>
        <p className="settle-text text-lg text-pretty text-muted-foreground">{t("body")}</p>
        {/* A plain anchor, as Link would add the locale. */}
        <div className="settle-text">
          <a href={href ?? "#generator"} className={buttonVariants({ size: "lg", className: "h-[56px] px-7" })}>
            {t("button")}
            <ArrowRight className="icon-nudge" />
          </a>
        </div>
      </InView>
    </section>
  );
}
