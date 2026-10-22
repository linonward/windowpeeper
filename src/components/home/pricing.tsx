import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { BuyPack, CheckoutNotice } from "@/components/billing/buy-pack";
import { type Pack, PackBenefits, packFacts, Recommended, useMoney, type VideoPrices } from "@/components/billing/packs";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { sceneImage, SCENES } from "@/lib/photo-effects";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

// The packs on the home page (`#pricing`): each card shows its videos as a
// stack of frames, then the price, the price per video and a button that
// buys the pack (checkout comes back here); then what every pack includes, a
// button up to the generator and a link to the price list.
export function Pricing({ packs, featured, prices }: { packs: readonly Pack[]; featured: string; prices: VideoPrices }) {
  const t = useTranslations("Home.pricing");
  const tPricing = useTranslations("Pricing");
  const billing = useTranslations("Billing");
  const money = useMoney();

  return (
    <section aria-labelledby="pricing-title" id="pricing" className="scroll-mt-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pt-6 pb-20 sm:px-8 lg:pb-28">
        <SectionHeading eyebrow={t("eyebrow")} id="pricing-title" aside={t("body")}>
          {t("title")}
        </SectionHeading>
        <CheckoutNotice />
        <ul className="grid gap-4 lg:grid-cols-3">
          {packs.map((pack, index) => {
            const facts = packFacts(pack, packs, prices);
            const lit = pack.id === featured;
            return (
              <li
                key={pack.id}
                className={cn(
                  "flex overflow-hidden rounded-xl border bg-card max-lg:flex-row lg:flex-col",
                  lit && "border-2 border-primary bg-primary-soft",
                )}
              >
                <div className="flex shrink-0 items-center justify-center gap-5 bg-background max-lg:w-[104px] max-lg:flex-col max-lg:gap-2 max-lg:py-4 lg:h-[210px]">
                  <Frames count={Math.min(index + 1, 3)} width={80} height={142} offset={12} className="max-lg:hidden" />
                  <Frames count={Math.min(index + 1, 3)} width={44} height={78} offset={7} className="lg:hidden" />
                  <div className="flex flex-col gap-0.5 max-lg:items-center">
                    <span className="font-display text-[1.75rem] leading-[0.9] font-black text-primary-text lg:text-[3.5rem]">
                      ×{facts.videos}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                      {billing("videosLabel", { videos: facts.videos })}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-3.5 p-5 max-lg:border-l lg:border-t",
                    lit && "border-primary",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "font-mono text-[11px] tracking-[0.14em] uppercase",
                        lit ? "text-primary-text" : "text-muted-foreground",
                      )}
                    >
                      {billing("packName", { videos: facts.videos })}
                    </span>
                    {lit && <Recommended className="text-[10px]" />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-display text-[clamp(2.5rem,10vw,3.25rem)] leading-[0.9] font-black tabular-nums">
                      {money(pack.amount, pack.currency)}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {facts.save > 0
                        ? billing("perVideoSave", { price: money(facts.perVideo, pack.currency), percent: facts.save })
                        : billing("perVideo", { price: money(facts.perVideo, pack.currency) })}
                    </span>
                  </div>
                  <BuyPack
                    pack={pack}
                    returnTo="packs"
                    aria-label={billing("buyLabel", {
                      credits: billing("credits", { count: pack.credits }),
                      price: money(pack.amount, pack.currency),
                    })}
                    variant={lit ? "default" : "outline"}
                    className="mt-auto w-full"
                  >
                    {tPricing("buy", { videos: facts.videos })}
                  </BuyPack>
                </div>
              </li>
            );
          })}
        </ul>
        <PackBenefits className="rounded-lg border bg-card px-6 py-[18px] max-lg:flex-col" />
        <div className="flex flex-col items-center gap-5 pt-2 sm:flex-row sm:justify-center">
          {/* A plain anchor, as Link would add the locale. */}
          <a href="#generator" className={cn(buttonVariants({ size: "lg" }), "max-sm:w-full")}>
            {t("cta")}
            <ArrowRight className="icon-nudge" />
          </a>
          <Link href="/pricing" className="text-[15px] font-semibold text-primary-text underline-offset-4 [@media(hover:hover)]:hover:underline">
            {t("more")} →
          </Link>
        </div>
      </div>
    </section>
  );
}

// One, two or three 9:16 frames with scene stills, fanned out like a stack.
export function Frames({
  count,
  width,
  height,
  offset,
  className,
}: {
  count: number;
  width: number;
  height: number;
  offset: number;
  className?: string;
}) {
  const spread = (count - 1) * offset;
  return (
    <span aria-hidden className={cn("relative block shrink-0", className)} style={{ width: width + spread, height: height + spread }}>
      {SCENES.slice(0, count)
        .reverse()
        .map((scene, index) => {
          const shift = (count - 1 - index) * offset;
          return (
            <span
              key={scene}
              className="absolute block overflow-hidden rounded-sm border border-foreground/25 bg-muted"
              style={{ left: shift, top: spread - shift, width, height }}
            >
              <Image src={sceneImage(scene)} alt="" fill sizes={`${width}px`} className="object-cover" />
            </span>
          );
        })}
    </span>
  );
}
