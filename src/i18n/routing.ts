import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "de"],
  defaultLocale: "en",
  // English pages have no prefix ("/pricing"); the others do ("/es/pricing").
  // "/en/..." redirects to the unprefixed page.
  localePrefix: "as-needed",
  // An unprefixed path is always English: no redirect by the language cookie
  // or the browser's languages, so each URL has one language.
  localeDetection: false,
  // Pages set their own hreflang links in metadata. The proxy's Link header
  // would name every locale for every path, even a translation that doesn't
  // exist, and a different x-default.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

// A page's path in a locale: unprefixed for the default locale ("/pricing",
// "/" for the home page), prefixed for the others ("/es/pricing", "/es").
// For links built by hand: canonical and hreflang URLs, redirects, emails.
// Components use Link from src/i18n/navigation.ts, which does the same.
export function localePath(locale: Locale, path = ""): string {
  return locale === routing.defaultLocale ? path || "/" : `/${locale}${path}`;
}

// Each language in its own name, for language menus. To add a locale, add it
// to `locales` and here, and add messages/<locale>.json.
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", es: "Español", de: "Deutsch" };
