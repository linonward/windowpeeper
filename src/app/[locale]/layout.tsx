import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { SidebarStateScript } from "@/components/dashboard/sidebar-state-script";
import { Analytics } from "@/components/layout/analytics";
import { LocalTimeZone } from "@/components/layout/local-time-zone";
import { clientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Body and UI (docs/DESIGN.md, Typography).
const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Display face for titles and numbers. Next.js has no metrics for it, so it
// can't make a fallback face and warns; globals.css declares one instead.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["Big Shoulders Fallback", "sans-serif"],
});

// Labels, timecodes and code.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    // Resolves relative canonical and hreflang URLs. Prerendered pages bake
    // it in, so set BETTER_AUTH_URL when building.
    metadataBase: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : undefined,
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const t = await getTranslations("Layout");
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${bigShoulders.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      style={{ colorScheme: "dark" }}
      // Dark only (docs/DESIGN.md). SidebarStateScript may change it before hydration.
      suppressHydrationWarning
    >
      <head>
        <SidebarStateScript />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Only what client components read: the rest renders on the server. */}
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <LocalTimeZone>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              {t("skip")}
            </a>
            {children}
          </LocalTimeZone>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
