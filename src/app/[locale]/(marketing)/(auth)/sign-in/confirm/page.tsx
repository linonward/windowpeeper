import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MagicLinkConfirm } from "@/components/auth/magic-link-confirm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MagicLinkConfirm");
  // Each link makes its own URL, and none answers a search.
  return { title: t("title"), robots: { index: false } };
}

type Query = PageProps<"/[locale]/sign-in/confirm">["searchParams"];

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

// Where the emailed magic link lands (confirmLink, src/server/auth/magic-link.ts).
// The card is prerendered; the button, which reads the query, streams in.
export default function ConfirmSignInPage({ searchParams }: PageProps<"/[locale]/sign-in/confirm">) {
  const t = useTranslations("MagicLinkConfirm");

  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-2xl border bg-card p-6 shadow-[0_24px_48px_-24px_oklch(0.21_0.008_75/0.25)] sm:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="display-tight font-display text-3xl font-semibold">{t("title")}</h1>
          <p className="text-pretty text-muted-foreground">{t("body")}</p>
        </div>
        <Suspense>
          <Confirm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Confirm({ searchParams }: { searchParams: Query }) {
  const query = await searchParams;
  return <MagicLinkConfirm token={one(query.token)} callbackURL={one(query.callbackURL)} />;
}
