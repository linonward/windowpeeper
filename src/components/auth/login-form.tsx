"use client";

import { LoaderCircle, Mail, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { type Locale, localePath } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { signInReturnPath } from "@/lib/sign-in";
import { Turnstile } from "./turnstile";

type State = "idle" | "sending" | "sent" | "error" | "google-error";
type Method = "google" | "email";

// The method used last in this browser, for the "Last used" tag. Kept in
// localStorage only, never sent to the server.
const LAST_METHOD = "windowpeeper:last-sign-in";

function readLastUsed(): Method | null {
  try {
    const saved = localStorage.getItem(LAST_METHOD);
    return saved === "google" || saved === "email" ? saved : null;
  } catch {
    return null;
  }
}

function remember(method: Method) {
  try {
    localStorage.setItem(LAST_METHOD, method);
  } catch {
    // Storage can be off (private mode); the tag is optional.
  }
}

// The ?error= Better Auth adds when it sends a failed sign-in back here.
function readError(): string | null {
  return new URLSearchParams(window.location.search).get("error");
}

// Nothing else writes the value while the page is open.
const noSubscribe = () => () => {};

function LastUsed({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -top-2.5 right-5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-semibold">
      {label}
    </span>
  );
}

// Google's four-color G, as its brand rules ask for.
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-[18px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// With a Turnstile site key, a magic link waits for the challenge and
// sends its token; the server rejects magic-link requests without one.
// `returnTo` is for a form outside /sign-in, which has no ?next=: a dialog
// returns to the page that opened it.
export function LoginForm({ turnstileSiteKey, returnTo }: { turnstileSiteKey?: string; returnTo?: string }) {
  const t = useTranslations("LoginForm");
  const locale = useLocale();
  const [state, setState] = useState<State>("idle");
  const [token, setToken] = useState<string | null>(null);
  // Bumped to remount the widget: a token works once.
  const [challenge, setChallenge] = useState(0);
  const [sentTo, setSentTo] = useState("");
  // null in the server render, which has no localStorage.
  const lastUsed = useSyncExternalStore(noSubscribe, readLastUsed, () => null);
  const failed = useSyncExternalStore(noSubscribe, readError, () => null);

  // Read at submit, not render, so the page needs no Suspense boundary.
  const callbackURL = () =>
    signInReturnPath(returnTo ?? new URLSearchParams(window.location.search).get("next"), locale);
  // A failed sign-in (a spent link, a canceled Google prompt) comes back to
  // the sign-in page, which says why and keeps where it was going.
  const errorCallbackURL = () =>
    `${localePath(locale as Locale, "/sign-in")}?next=${encodeURIComponent(callbackURL())}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const email = String(new FormData(event.currentTarget).get("email"));
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: callbackURL(),
      errorCallbackURL: errorCallbackURL(),
      fetchOptions: { headers: token ? { "x-captcha-response": token } : {} },
    });
    setState(error ? "error" : "sent");
    if (!error) {
      track("sign_in_started", { method: "email" });
      remember("email");
      setSentTo(email);
    }
    if (error && turnstileSiteKey) {
      setToken(null);
      setChallenge((n) => n + 1);
    }
  }

  async function onGoogle() {
    track("sign_in_started", { method: "google" });
    remember("google");
    setState("sending");
    // On success the browser navigates to Google, so only errors land here.
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackURL(),
      errorCallbackURL: errorCallbackURL(),
    });
    if (error) setState("google-error");
  }

  if (state === "sent") {
    return (
      <p role="status" className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary-text" />
        <span>{t("sent", { email: sentTo })}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {failed && state === "idle" && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {t(failed.includes("TOKEN") ? "linkError" : "signInError")}
        </p>
      )}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={state === "sending"}
          onClick={onGoogle}
          className="w-full"
        >
          <GoogleG />
          {t("google")}
        </Button>
        {lastUsed === "google" && <LastUsed label={t("lastUsed")} />}
      </div>
      {state === "google-error" && (
        <p role="alert" className="text-sm text-destructive">
          {t("googleError")}
        </p>
      )}
      <p className="flex items-center gap-3 text-sm text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        {t("or")}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("placeholder")}
            required
            // As tall as the buttons around it.
            className="h-12 px-4 md:text-[15px]"
          />
        </div>
        {turnstileSiteKey && <Turnstile key={challenge} siteKey={turnstileSiteKey} onToken={setToken} />}
        <div className="relative">
          <Button
            type="submit"
            size="lg"
            disabled={state === "sending" || Boolean(turnstileSiteKey && !token)}
            className="w-full"
          >
            {/* Both icons stay mounted and cross-fade, so the label never shifts. */}
            <span className="relative size-4">
              <Mail
                className={`icon-swap absolute inset-0 ${state === "sending" ? "scale-50 opacity-0" : ""}`}
              />
              <LoaderCircle
                className={`icon-swap absolute inset-0 animate-spin ${state === "sending" ? "" : "scale-50 opacity-0"}`}
              />
            </span>
            {t("send")}
          </Button>
          {lastUsed === "email" && <LastUsed label={t("lastUsed")} />}
        </div>
        {state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {t("sendError")}
          </p>
        )}
      </form>
      <p className="text-center text-sm text-pretty text-muted-foreground">
        {t.rich("terms", {
          terms: (chunks) => (
            <Link href="/terms" className="underline underline-offset-4 [@media(hover:hover)]:hover:text-foreground">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="underline underline-offset-4 [@media(hover:hover)]:hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
