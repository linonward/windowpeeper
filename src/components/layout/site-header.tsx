import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";

// The nav's links: two of the home page's sections, the price list and the
// blog. Phones reach them from the menu.
export const NAV_LINKS = [
  { key: "scenes", href: "/#scenes" },
  { key: "howItWorks", href: "/#how-it-works" },
  { key: "pricing", href: "/pricing" },
  { key: "blog", href: "/blog" },
] as const;

// Sticky bar with a bottom border (docs/DESIGN.md, Nav). `account` is the
// sign-in link: the marketing layout passes <AccountLink /> for the visitor.
export function SiteHeader({ account }: { account: React.ReactNode }) {
  const t = useTranslations("Nav");
  const tBlog = useTranslations("Blog");
  const label = (key: (typeof NAV_LINKS)[number]["key"]) => (key === "blog" ? tBlog("title") : t(key));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8 md:h-[73px]">
        <Brand />
        <nav aria-label={t("label")} className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className="text-sm text-muted-foreground transition-colors [@media(hover:hover)]:hover:text-foreground"
            >
              {label(key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3.5 md:gap-3">
          <LocaleSwitcher />
          {account}
          <Link href="/#generator" className={cn(buttonVariants(), "hidden md:inline-flex")}>
            {t("cta")}
          </Link>
          <MobileMenu
            links={NAV_LINKS.map(({ key, href }) => ({ href, label: label(key) }))}
            cta={t("cta")}
            label={t("label")}
            menu={t("menu")}
          />
        </div>
      </div>
    </header>
  );
}

// Sign in for visitors, the videos page for signed-in users.
export function AccountLink({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations(signedIn ? "Dashboard" : "SignIn");

  return (
    <Link
      href={signedIn ? "/videos" : "/sign-in"}
      className="text-sm font-medium whitespace-nowrap underline-offset-4 [@media(hover:hover)]:hover:underline"
    >
      {t("title")}
    </Link>
  );
}
