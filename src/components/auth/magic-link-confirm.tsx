import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// The step between the email and Better Auth's verify endpoint. A plain GET
// form, so it works without JavaScript; only a press sends the token.
export function MagicLinkConfirm({ token, callbackURL }: { token?: string; callbackURL?: string }) {
  const t = useTranslations("MagicLinkConfirm");

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t("invalid")}</p>
        <Link href="/sign-in" className="font-medium text-primary-text underline underline-offset-4">
          {t("retry")}
        </Link>
      </div>
    );
  }

  return (
    <form method="get" action="/api/auth/magic-link/verify" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {callbackURL && <input type="hidden" name="callbackURL" value={callbackURL} />}
      <Button type="submit" size="lg">
        {t("continue")}
      </Button>
    </form>
  );
}
