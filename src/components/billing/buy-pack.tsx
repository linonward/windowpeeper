"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import type { Pack } from "./packs";
import { redirectFrom } from "./redirect";

// Sign-in returns with it, and the button for that pack opens checkout.
const BUY = "buy";

// A pack's buy button on the price list and the home page's packs: straight
// to checkout, which comes back to this page (`returnTo`, see
// src/app/api/payment/checkout/route.ts). A signed-out visitor signs in from
// a dialog first; sign-in returns with ?buy=<pack> and checkout opens.
export function BuyPack({
  pack,
  returnTo,
  children,
  ...props
}: { pack: Pack; returnTo: "pricing" | "packs" } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const session = authClient.useSession();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signIn, setSignIn] = useState<string | null>(null);
  const resumed = useRef(false);

  function askToSignIn() {
    const url = new URL(window.location.href);
    url.searchParams.set(BUY, pack.id);
    setSignIn(url.pathname + url.search + url.hash);
  }

  async function buy() {
    if (!session.data && !session.isPending) return askToSignIn();
    setBuying(true);
    setError(null);
    const code = await redirectFrom("/api/payment/checkout", { packId: pack.id, locale, returnTo });
    if (code === null) return;
    setBuying(false);
    if (code === "UNAUTHORIZED") return askToSignIn();
    setError(t(code === "PAYMENTS_DISABLED" ? "disabled" : "checkoutError"));
  }

  // Once, back from sign-in, on this pack's button.
  useEffect(() => {
    if (session.isPending || resumed.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(BUY) !== pack.id) return;
    resumed.current = true;
    url.searchParams.delete(BUY);
    window.history.replaceState(null, "", url);
    // Buying starts here, as a click does.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void buy();
    // buy reads only props, the session and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isPending]);

  return (
    <>
      <Button type="button" disabled={buying} onClick={buy} {...props}>
        {buying ? t("paying") : children}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Dialog open={signIn !== null} onOpenChange={(open) => !open && setSignIn(null)}>
        <DialogContent closeLabel={t("close")}>
          <DialogHeader>
            <DialogTitle>{t("signIn.title")}</DialogTitle>
            <DialogDescription>{t("signIn.body")}</DialogDescription>
          </DialogHeader>
          {signIn && <LoginForm returnTo={signIn} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Back from a checkout BuyPack started: payment received, or canceled. The
// generator's own checkout (?try=1) shows its messages there instead.
export function CheckoutNotice({ className }: { className?: string }) {
  const t = useTranslations("Billing");
  const [checkout, setCheckout] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("checkout");
    if (url.searchParams.has("try") || (value !== "success" && value !== "cancel")) return;
    url.searchParams.delete("checkout");
    // A reload then shows the plain page.
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckout(value);
  }, []);

  if (!checkout) return null;
  return (
    <p role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-4 text-pretty ${className ?? ""}`}>
      {t(checkout === "cancel" ? "canceled" : "arriving")}
      {checkout === "success" && (
        <Link href="/#generator" className="font-semibold text-primary-text underline-offset-4 [@media(hover:hover)]:hover:underline">
          {t("makeVideo")}
        </Link>
      )}
    </p>
  );
}
