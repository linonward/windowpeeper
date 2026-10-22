import type { Metadata, ResolvingMetadata } from "next";
import { projectConfig } from "project.config";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { homeFacts } from "@/app/_lib/home-facts";
import { About } from "@/components/home/about";
import { Cta } from "@/components/home/cta";
import { Faq } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Pricing } from "@/components/home/pricing";
import { Strip } from "@/components/home/strip";
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

// The tip-toe dance clip beside the generator, from public/, and when it was
// added, for its structured data. Change the date with the clip.
const EXAMPLE = { sample: "/landing/tiptoe/sample.mp4", poster: "/landing/tiptoe/poster.jpg" };
const EXAMPLE_ADDED = "2026-10-19";

// The tip-toe generator in the hero does the whole job on this page; the
// sections below explain it. The session is read in the browser, so the
// page stays prerendered.
export default function Home() {
  const { featured, prices, ...tryout } = homeFacts();
  // The hero runs full width; the sections below keep the page's column.
  return (
    <main id="main-content" className="w-full flex-1">
      <SiteData />
      <Hero tryout={tryout} example={EXAMPLE} />
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Strip />
        <HowItWorks />
        <About credits={tryout.credits} proCredits={tryout.proCredits} />
        <Pricing packs={tryout.packs} featured={featured} prices={prices} />
        <Faq
          credits={tryout.credits}
          proCredits={tryout.proCredits}
          packs={tryout.packs}
          size={tryout.maxPickBytes / 1024 / 1024}
        />
        <Cta />
      </div>
    </main>
  );
}

// The names people search for the site by, in both word orders. English in
// every locale, as people search them.
const SITE_NAMES = ["AI Rumpelstiltskin Video Generator", "Rumpelstiltskin AI Video Generator"];

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
        name: t("Home.example.title"),
        description: t("Home.example.video"),
        contentPath: EXAMPLE.sample,
        thumbnailPath: EXAMPLE.poster,
        uploadDate: EXAMPLE_ADDED,
        seconds: 9,
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
