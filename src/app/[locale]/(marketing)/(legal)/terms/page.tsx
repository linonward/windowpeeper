import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { projectConfig } from "project.config";
import { LegalPage } from "@/components/legal/legal-page";
import { languageAlternates } from "@/lib/seo";
import { localePath, type Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Legal");
  return {
    title: t("terms"),
    description: t("descriptions.terms", { name: projectConfig.name }),
    alternates: { canonical: localePath(locale as Locale, "/terms"), languages: languageAlternates("/terms") },
  };
}

export default function Page() {
  return <LegalPage doc="terms" />;
}
