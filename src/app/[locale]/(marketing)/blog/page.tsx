import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BlogIndex } from "@/components/blog/blog-index";
import { blogLocales } from "@/lib/content";
import type { Locale } from "@/i18n/routing";
import { languageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Blog");
  // A locale without posts keeps its (empty) blog out of search, and the
  // others link only the blogs that have posts.
  const withPosts = await blogLocales();
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `/${locale}/blog`, languages: languageAlternates("/blog", withPosts) },
    ...(!withPosts.includes(locale as Locale) && { robots: { index: false, follow: true } }),
  };
}

export default function Page() {
  return <BlogIndex />;
}
