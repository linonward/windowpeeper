import type { Metadata, ResolvingMetadata } from "next";
import { getTranslations } from "next-intl/server";
import { projectConfig } from "project.config";
import { homeFacts } from "@/app/_lib/home-facts";
import { GuidePage } from "@/components/guides/guide-page";
import type { Locale } from "@/i18n/routing";
import type { Guide } from "@/lib/guides";
import { languageAlternates } from "@/lib/seo";

// A guide's metadata: its title (the layout's template adds the site's
// name), description, canonical URL, languages and Open Graph, from
// Guides.pages.<guide>.
export function guideMetadata(guide: Guide) {
  return async function generateMetadata(
    { params }: { params: Promise<{ locale: string }> },
    parent: ResolvingMetadata,
  ): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale: locale as Locale, namespace: "Guides" });
    const title = t(`pages.${guide}.metaTitle`);
    const description = t(`pages.${guide}.metaDescription`);
    return {
      title,
      description,
      alternates: { canonical: `/${locale}/${guide}`, languages: languageAlternates(`/${guide}`) },
      openGraph: {
        // Keep the layout's generated preview image when extending Open Graph.
        images: (await parent).openGraph?.images,
        type: "article",
        siteName: projectConfig.name,
        title,
        description,
        url: `/${locale}/${guide}`,
      },
    };
  };
}

// The guide, with the prices and photo limits the home page states.
// Prerendered, like the home page.
export function GuideRoute({ guide }: { guide: Guide }) {
  const { credits, proCredits, packs, maxPickBytes, imageLimits } = homeFacts();
  return <GuidePage guide={guide} facts={{ credits, proCredits, packs, maxPickBytes, imageLimits }} />;
}
