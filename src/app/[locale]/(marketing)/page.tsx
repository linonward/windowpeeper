import type { Metadata, ResolvingMetadata } from "next";
import { projectConfig } from "project.config";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { homeFacts } from "@/app/_lib/home-facts";
import { BeforeAfter } from "@/components/home/before-after";
import { Cta } from "@/components/home/cta";
import { Faq } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Pricing } from "@/components/home/pricing";
import { Scenes } from "@/components/home/scenes";
import { ShotList } from "@/components/home/shot-list";
import { StickyCta } from "@/components/home/sticky-cta";
import type { Locale } from "@/i18n/routing";
import { howTo, jsonLd, languageAlternates, videoObject, website } from "@/lib/seo";

// The description comes from the locale layout. The title says what the site
// is next to its name: the layout's template would only add the name again.
export async function generateMetadata(
  { params }: PageProps<"/[locale]">,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Metadata");
  return {
    title: { absolute: t("homeTitle") },
    openGraph: {
      // Keep the layout's generated preview image when extending Open Graph.
      images: (await parent).openGraph?.images,
      type: "website",
      siteName: projectConfig.name,
      title: t("homeTitle"),
      description: t("description"),
      url: `/${locale}`,
    },
    alternates: { canonical: `/${locale}`, languages: languageAlternates("") },
  };
}

// A real window peeper video in the hero, from public/, made from an
// AI-generated person, and when it was added, for its structured data.
// Change the date and the seconds with the clip.
const EXAMPLE = { sample: "/landing/windowpeeper/sample.mp4", poster: "/landing/windowpeeper/poster.jpg" };
const EXAMPLE_ADDED = "2026-10-22";
const EXAMPLE_SECONDS = 12;

// The window peeper generator in the hero does the whole job on this page; the
// sections below explain it. The session is read in the browser, so the
// page stays prerendered.
export default function Home() {
  const { prices, ...tryout } = homeFacts();
  const format = useFormatter();
  const t = useTranslations("Home.sticky");
  // The smallest pack's price, which the FAQ and the phone's sticky bar state.
  // Amounts are in the currency's smallest unit; packs use two-decimal currencies.
  const [smallest] = tryout.packs;
  const from = format.number(smallest.amount / 100, { style: "currency", currency: smallest.currency.toUpperCase() });
  // Each section runs full width and keeps its own column.
  return (
    <main id="main-content" className="w-full flex-1">
      <SiteData />
      <Hero tryout={tryout} example={EXAMPLE} />
      <BeforeAfter />
      <Scenes />
      <HowItWorks />
      <Pricing packs={tryout.packs} featured={tryout.featured} prices={prices} />
      <ShotList />
      <Faq price={from} size={tryout.maxPickBytes / 1024 / 1024} />
      <Cta />
      <StickyCta title={t("title")} body={t("body", { price: from })} button={t("button")} />
    </main>
  );
}

// The names people search for the site by, in both word orders. English in
// every locale, as people search them.
const SITE_NAMES = ["Window Peeper AI Video Generator", "AI Window Peeper Video Generator"];

// For search engines: the site's name and publisher, the example clip and
// the three steps, as the page shows them.
function SiteData() {
  const locale = useLocale() as Locale;
  const t = useTranslations();
  // Prerendered, so set BETTER_AUTH_URL when building, as for canonical links.
  const base = process.env.BETTER_AUTH_URL;
  const steps = (["1", "2", "3"] as const).map((key) => ({
    name: t(`Home.steps.items.${key}.title`),
    text: t(`Home.steps.items.${key}.body`),
  }));
  const data = {
    site: website(locale, t("Metadata.description"), base, SITE_NAMES),
    video: videoObject(
      {
        name: t("Home.hero.clip.name"),
        description: t("Home.hero.clip.description"),
        contentPath: EXAMPLE.sample,
        thumbnailPath: EXAMPLE.poster,
        uploadDate: EXAMPLE_ADDED,
        seconds: EXAMPLE_SECONDS,
      },
      locale,
      base,
    ),
    steps: howTo(locale, t("Home.steps.title"), steps),
  };
  return Object.entries(data).map(([key, item]) => (
    <script key={key} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(item) }} />
  ));
}
