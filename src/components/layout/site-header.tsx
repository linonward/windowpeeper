import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Brand } from "./brand";
import { LocaleSwitcher } from "./locale-switcher";

// The home page's sections, as on the reference landing page. Below `md`
// only Pricing shows, so the header fits a 320px phone; phones reach the
// others by scrolling and the blog from the footer.
const SECTIONS = [
  { key: "howItWorks", hash: "how-it-works", phone: false },
  { key: "pricing", hash: "pricing", phone: true },
  { key: "faq", hash: "faq", phone: false },
] as const;

const LINK = "text-sm font-semibold underline-offset-4 [@media(hover:hover)]:hover:underline";

// Sticky glass bar (docs/DESIGN.md, Effects). `account` is the button on the
// right: the marketing layout passes <AccountLink /> for the visitor.
export function SiteHeader({ account }: { account: React.ReactNode }) {
  const t = useTranslations("Nav");
  const tBlog = useTranslations("Blog");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/65 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2 sm:gap-6">
          <nav aria-label={t("label")} className="flex items-center gap-2 sm:gap-6">
            {SECTIONS.map(({ key, hash, phone }) => (
              <Link key={key} href={`/#${hash}`} className={cn(LINK, !phone && "hidden md:inline")}>
                {t(key)}
              </Link>
            ))}
            <Link href="/blog" className={cn(LINK, "hidden md:inline")}>
              {tBlog("title")}
            </Link>
          </nav>
          <LocaleSwitcher />
          {account}
        </div>
      </div>
    </header>
  );
}

// Sign in for visitors, the videos page for signed-in users. Smaller on
// phones, so the header fits 320px.
export function AccountLink({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations(signedIn ? "Dashboard" : "SignIn");

  return (
    <Link href={signedIn ? "/videos" : "/sign-in"} className={cn(buttonVariants(), "h-9 px-2.5 sm:h-10 sm:px-4")}>
      {t("title")}
    </Link>
  );
}
