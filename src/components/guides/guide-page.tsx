import { ArrowRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Cta } from "@/components/home/cta";
import { Glow } from "@/components/home/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { GUIDES, type Guide } from "@/lib/guides";
import type { ImageLimits } from "@/lib/image-limits";

type Pack = { credits: number; amount: number; currency: string };

export type GuideFacts = {
  credits: number;
  proCredits: number;
  packs: readonly Pack[];
  // The largest photo a visitor may pick, which the copy states.
  maxPickBytes: number;
  imageLimits: ImageLimits;
};

// A section of a guide's copy (Guides.pages.<slug>.sections.<key>), in this
// order: paragraphs, a list or numbered steps, then more paragraphs.
type Section = {
  title: string;
  text?: Record<string, string>;
  list?: Record<string, string>;
  steps?: Record<string, { title: string; body: string }>;
  more?: Record<string, string>;
};

type Translate = {
  (key: string, values?: Record<string, string | number>): string;
  rich: (key: string, values: Record<string, unknown>) => ReactNode;
  raw: (key: string) => unknown;
};

const LINK = "font-medium text-primary-text underline underline-offset-4";

// A guide: the query in the h1, a call to action that leads to the home
// page's generator (no second generator here), the copy in sections, links to
// the other guides and the closing call to action. Prices and photo limits
// come from the server config, which the page passes in.
export function GuidePage({ guide, facts }: { guide: Guide; facts: GuideFacts }) {
  // Guides.pages.<guide> has the same shape for every guide, but not the same
  // section keys, so its keys are built at runtime.
  const t = useTranslations("Guides") as unknown as Translate;
  const locale = useLocale();
  const format = useFormatter();
  const page = (key: string) => `pages.${guide}.${key}`;
  const generator = `/${locale}#generator`;

  const money = (pack: Pack) =>
    format.number(pack.amount / 100, { style: "currency", currency: pack.currency.toUpperCase() });
  const [cheapest] = [...facts.packs].sort((a, b) => a.amount - b.amount);
  const values = {
    credits: facts.credits,
    proCredits: facts.proCredits,
    price: money(cheapest),
    packs: format.list(
      facts.packs.map((pack) => t("pack", { credits: pack.credits, price: money(pack) })),
    ),
    size: facts.maxPickBytes / 1024 / 1024,
    min: facts.imageLimits.minSide,
    maxSide: facts.imageLimits.maxSide,
    // Links inside the copy.
    generator: (chunks: ReactNode) => (
      <a href={generator} className={LINK}>
        {chunks}
      </a>
    ),
    howto: guideLink("how-to-make-window-peeper-video"),
    terms: pageLink("/terms"),
    privacy: pageLink("/privacy"),
    email: () => (
      <a href={`mailto:${projectConfig.supportEmail}`} className={LINK}>
        {projectConfig.supportEmail}
      </a>
    ),
  };
  const rich = (key: string) => t.rich(key, values);
  const sections = t.raw(page("sections")) as Record<string, Section>;
  const others = GUIDES.filter((each) => each !== guide);

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
      <header className="relative isolate flex flex-col items-start gap-6 pt-10 pb-16 sm:pt-16">
        <Glow className="top-10" />
        <p className="eyebrow">{t("eyebrow")}</p>
        {/* As on the home page: the query, then the tagline. The size follows
            the width on phones, so long words fit. */}
        <h1 className="display-tight max-w-4xl hyphens-auto [overflow-wrap:break-word] font-display text-[clamp(1.5rem,8.2vw,2.25rem)] leading-[1.15] font-bold text-balance break-keep sm:text-5xl sm:leading-[1.2]">
          <span className="block">{t(page("title"))}</span>
          {" "}
          <span className="sr-only">—</span>{" "}
          <span className="block text-muted-foreground">{t(page("tagline"))}</span>
        </h1>
        <p className="max-w-[60ch] text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
          {rich(page("lead"))}
        </p>
        <div className="flex flex-col items-start gap-3">
          {/* A plain anchor: the generator is on another page, at its id. */}
          <a href={generator} className={buttonVariants({ size: "lg" })}>
            {t("cta")}
            <ArrowRight className="icon-nudge" />
          </a>
          <p className="text-sm text-muted-foreground">{t("ctaNote", { credits: facts.credits })}</p>
        </div>
      </header>

      {Object.entries(sections).map(([key, section]) => {
        const id = `guide-${key}`;
        const at = (part: string) => page(`sections.${key}.${part}`);
        return (
          <section
            key={key}
            aria-labelledby={id}
            className="grid grid-cols-1 gap-6 border-t py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10"
          >
            <h2 id={id} className="display-tight font-display text-2xl leading-tight font-bold text-balance sm:text-3xl">
              {t(at("title"))}
            </h2>
            <div className="flex max-w-[65ch] flex-col gap-4 leading-7 text-pretty text-muted-foreground">
              {Object.keys(section.text ?? {}).map((n) => (
                <p key={n}>{rich(at(`text.${n}`))}</p>
              ))}
              {section.list && (
                <ul className="list-disc space-y-2 pl-5 marker:text-primary-text">
                  {Object.keys(section.list).map((n) => (
                    <li key={n}>{rich(at(`list.${n}`))}</li>
                  ))}
                </ul>
              )}
              {section.steps && (
                <ol className="flex flex-col gap-6">
                  {Object.keys(section.steps).map((n, i) => (
                    <li key={n} className={cn("flex gap-4 border-t-2 pt-4", i === 0 && "border-primary-text")}>
                      <span
                        aria-hidden
                        className={cn(
                          "font-display text-2xl font-bold tabular-nums",
                          i === 0 ? "text-primary-text" : "text-muted-foreground/60",
                        )}
                      >
                        {n.padStart(2, "0")}
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="font-display text-lg font-semibold text-foreground">
                          {t(at(`steps.${n}.title`))}
                        </h3>
                        <p>{rich(at(`steps.${n}.body`))}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {Object.keys(section.more ?? {}).map((n) => (
                <p key={n}>{rich(at(`more.${n}`))}</p>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mb-12 max-w-[65ch] rounded-xl border bg-card p-5 text-sm leading-6 text-pretty text-muted-foreground">
        {t("note")}
      </p>

      {others.length > 0 && (
        <nav aria-labelledby="guide-related" className="flex flex-col gap-6 border-t py-12">
          <h2 id="guide-related" className="display-tight font-display text-2xl leading-tight font-bold sm:text-3xl">
            {t("related")}
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {others.map((other) => (
              <li key={other}>
                <Link
                  href={`/${other}`}
                  className="flex h-full flex-col gap-2 rounded-xl border bg-card p-5 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
                >
                  <span className="font-display text-lg font-semibold">{t(`pages.${other}.nav`)}</span>
                  <span className="text-sm text-pretty text-muted-foreground">{t(`pages.${other}.metaDescription`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <Cta href={generator} />
    </main>
  );
}

function guideLink(guide: Guide) {
  return pageLink(`/${guide}`);
}

function pageLink(href: string) {
  function PageLink(chunks: ReactNode) {
    return (
      <Link href={href} className={LINK}>
        {chunks}
      </Link>
    );
  }
  return PageLink;
}
