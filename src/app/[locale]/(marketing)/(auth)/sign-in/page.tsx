import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/layout/logo-mark";
import { localePath, type Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("SignIn");
  // A sign-in form answers no search, and ?next= makes a URL per page; the
  // canonical folds them into one.
  return {
    title: t("title"),
    description: t("subtitle"),
    robots: { index: false },
    alternates: { canonical: localePath(locale as Locale, "/sign-in") },
  };
}

// docs/DESIGN.md, Sign in: no card, centered under the mark, as the boards
// show it. The form is the same one the sign-in dialogs use.
export default function SignInPage() {
  const t = useTranslations("SignIn");

  return (
    <main id="main-content" className="flex flex-1 justify-center px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-28">
      <div className="flex w-full max-w-[520px] flex-col gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl border bg-card">
            <LogoMark className="size-8" />
          </span>
          <h1 className="font-display text-4xl leading-[1.05] font-extrabold text-balance sm:text-[44px]">
            {t("heading")}
          </h1>
          <p className="text-lg text-balance text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </div>
    </main>
  );
}
