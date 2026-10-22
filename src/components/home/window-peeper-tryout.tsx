"use client";

import { CreditCard, Download, LoaderCircle, LockKeyhole, Plus, Share2, Sparkles } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { LoginForm } from "@/components/auth/login-form";
import { usePackBuys, type VideoPrices } from "@/components/billing/packs";
import { redirectFrom } from "@/components/billing/redirect";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffectMessages } from "@/components/videos/effect-messages";
import { playerFrame } from "@/components/videos/player-frame";
import { usePhotoPicks } from "@/components/videos/use-photo-picks";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { track } from "@/lib/analytics";
import type { ApiBody, ApiErrorCode, GeneratedVideo, Serialized, VideoResponse } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { type ImageLimits, limitValues } from "@/lib/image-limits";
import { clearPhotoDraft, loadPhotoDraft, type PhotoDraft, savePhotoDraft } from "@/lib/photo-draft";

// The photo types the server takes; a drop of another type is refused here.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Pack = { id: string; credits: number; amount: number; currency: string };

export type WindowPeeperTryoutProps = {
  // The fixed price of one video, standard and Pro.
  credits: number;
  proCredits: number;
  // The largest photo a visitor may pick, which the copy states, and the
  // largest the server takes, which the browser shrinks it to fit.
  maxPickBytes: number;
  maxUploadBytes: number;
  imageLimits: ImageLimits;
  // False without Bailian or storage.
  enabled: boolean;
  // The credit packs on sale, smallest first, offered when credits run short.
  packs: readonly Pack[];
};

const ENDPOINT = "/api/videos/windowpeeper";
const DRAFT_KEY = "home:windowpeeper";
// Sign-in and checkout return with it, so the page sends the saved photo.
const RESUME = "try";
// Checkout adds it: success or cancel (src/app/api/payment/checkout/route.ts).
const CHECKOUT = "checkout";
// The draft fields that record the consent, the quality and the format.
const CONSENT = "consent";
const QUALITY = "quality";
const RATIO = "ratio";
// What the API's quality field takes. Standard is 720P; Pro, 1080P; the
// free preview, 5 seconds with a watermark, once per account.
type Quality = "preview" | "standard" | "pro";
// The two the form offers; the free preview is a link under the button.
const CHOICES = ["standard", "pro"] as const;
type Choice = (typeof CHOICES)[number];
// Every video is vertical (9:16), the shape of TikTok, Reels and Shorts, where
// the meme lives. A draft saved when the form offered widescreen keeps it.
const VERTICAL = "9:16";
const ratioOf = (value: string | undefined) => (value === "16:9" ? "16:9" : VERTICAL);
// As EffectGenerator polls.
const POLL_MS = 5000;
// The webhook credits a payment within a minute or so; until then a send
// answers 402. After a payment, send every 3 s for 90 s.
const RETRY_MS = 3000;
const TRIES = 30;

const ERRORS = {
  INVALID_REQUEST: "errors.invalid",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (video: Serialized<GeneratedVideo>): GeneratedVideo => ({
  ...video,
  createdAt: new Date(video.createdAt),
});

// The window peeper video on the home page, from photo to finished video, with as
// few controls as it takes: the photo, Standard or Pro, and one button whose
// note says pressing it confirms consent; the free preview is a link under it.
// A signed-out visitor signs in from a dialog; the photo and the choice wait
// in the browser and go out when sign-in brings them back here. Without enough credits, it offers the packs
// and goes to checkout the same way; back from a payment, it sends once the
// credits arrive. The video then renders in place: progress, then a player
// with download and share. Each step the visitor takes is a funnel event
// (src/lib/analytics.ts), sent from its handler so it counts once.
export function WindowPeeperTryout(props: WindowPeeperTryoutProps) {
  const t = useEffectMessages("windowpeeper");
  const tt = useTranslations("HomeTryout");
  const tb = useTranslations("Billing");
  const locale = useLocale();
  const session = authClient.useSession();
  const [quality, setQuality] = useState<Choice>("standard");
  const [error, setError] = useState<string | null>(null);
  // Packs on offer: credits ran short, or checkout was canceled.
  const [offer, setOffer] = useState<"short" | "canceled" | null>(null);
  // The pack picked; null picks the smallest that pays for the video.
  const [packId, setPackId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  // Back from a payment: waiting for the credits, or given up on them.
  const [paid, setPaid] = useState<"waiting" | "late" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signIn, setSignIn] = useState<string | null>(null);
  const [video, setVideo] = useState<GeneratedVideo | null>(null);
  const [copied, setCopied] = useState(false);
  // The draft restored after sign-in or a payment, sent once the session is known.
  const [resume, setResume] = useState<{ draft: PhotoDraft; paid: boolean } | null>(null);
  const resumed = useRef(false);
  // One send at a time, so a video is never made twice.
  const sending = useRef(false);
  // Stops the retries after a payment when the page goes.
  const mounted = useRef(true);

  const size = Math.round(props.maxPickBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, min, maxSide, ratio };
  const { photos, previews, pick } = usePhotoPicks({
    maxPickBytes: props.maxPickBytes,
    maxUploadBytes: props.maxUploadBytes,
    imageLimits: props.imageLimits,
    onError: (key) => {
      setOffer(null);
      setError(key && t(`errors.${key}`, messageValues));
    },
  });
  const photo = photos.left;
  const ready = props.enabled && photo !== null;
  const price = (choice: Quality) => (choice === "preview" ? 0 : choice === "pro" ? props.proCredits : props.credits);
  // The price of the quality picked: on the button, and in the 402 message.
  const credits = price(quality);
  const pack =
    props.packs.find((each) => each.id === packId) ??
    props.packs.find((each) => each.credits >= credits) ??
    props.packs.at(-1);

  usePendingPoll({
    ids: video?.status === "pending" ? [video.id] : [],
    intervalMs: POLL_MS,
    url: (id) => `/api/videos/${id}`,
    onBody: (_, body) => {
      const { video: polled } = body as ApiBody<VideoResponse>;
      if (polled && polled.status !== "pending") setVideo(parse(polled));
    },
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Returns "short" on a 402, for the caller to offer packs or wait for
  // paid credits.
  async function send(draft: PhotoDraft): Promise<"short" | undefined> {
    if (sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setError(null);
    setOffer(null);
    const form = new FormData();
    form.set("image1", draft.photos[0]);
    form.set("quality", draft.fields[QUALITY] ?? "standard");
    form.set("ratio", ratioOf(draft.fields[RATIO]));
    // The server refuses a photo without it, and records when it was given.
    form.set("consent", draft.fields[CONSENT] ?? "");
    const response = await fetch(ENDPOINT, { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};
    sending.current = false;
    setSubmitting(false);

    if (response?.ok && body.video) {
      await clearPhotoDraft(DRAFT_KEY);
      setCopied(false);
      setVideo(parse(body.video));
      return;
    }
    if (response?.status === 401) {
      await askToSignIn(draft);
      return;
    }
    if (body.error === "INSUFFICIENT_CREDITS") return "short";
    if (body.error === "PREVIEW_USED") {
      setQuality("standard");
      setError(tt("previewUsed"));
      return;
    }
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  function offerPacks(reason: "short" | "canceled") {
    setPackId(null);
    setBuyError(null);
    setOffer(reason);
  }

  // The packs, after a send the visitor started answered 402. The retries
  // after a payment wait instead, and record nothing.
  function paywall(draft: PhotoDraft) {
    const picked: Quality = draft.fields[QUALITY] === "pro" ? "pro" : "standard";
    track("paywall_viewed", { quality: picked, credits_needed: price(picked) });
    offerPacks("short");
  }

  // A 402 makes no video, so sending until one gets through makes one.
  async function sendPaid(draft: PhotoDraft) {
    let outcome = await send(draft);
    for (let tries = 1; outcome === "short" && tries < TRIES && mounted.current; tries++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      if (mounted.current) outcome = await send(draft);
    }
    setPaid(outcome === "short" ? "late" : null);
  }

  // A payment that comes back without a session keeps its place, so
  // sign-in returns to the wait for credits.
  async function askToSignIn(draft: PhotoDraft, afterPayment = false) {
    await savePhotoDraft(DRAFT_KEY, draft);
    setPaid(null);
    const url = new URL(window.location.href);
    url.searchParams.set(RESUME, "1");
    if (afterPayment) url.searchParams.set(CHECKOUT, "success");
    setSignIn(url.pathname + url.search);
  }

  // Checkout leaves the page, so the draft is saved first; checkout returns
  // to ?try=1 and the page sends it.
  async function buy() {
    if (!ready || !photo || !pack) return;
    const draft = { photos: [photo], fields: { [CONSENT]: "yes", [QUALITY]: quality, [RATIO]: VERTICAL } };
    track("checkout_clicked", { pack_id: pack.id, quality });
    setBuying(true);
    setBuyError(null);
    await savePhotoDraft(DRAFT_KEY, draft);
    const code = await redirectFrom("/api/payment/checkout", { packId: pack.id, locale, returnTo: "home" });
    if (code === null) return;
    setBuying(false);
    if (code === "UNAUTHORIZED") return askToSignIn(draft);
    setBuyError(tb(code === "PAYMENTS_DISABLED" ? "disabled" : "checkoutError"));
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RESUME)) return;
    const checkout = url.searchParams.get(CHECKOUT);
    url.searchParams.delete(RESUME);
    url.searchParams.delete(CHECKOUT);
    window.history.replaceState(null, "", url);
    void loadPhotoDraft(DRAFT_KEY).then((draft) => {
      if (draft?.photos.length !== 1) return;
      pick("left", draft.photos[0]);
      const agreed = draft.fields[CONSENT] === "yes";
      setQuality(draft.fields[QUALITY] === "pro" ? "pro" : "standard");
      // A canceled payment offers the packs again and sends nothing.
      if (checkout === "cancel") return offerPacks("canceled");
      // A draft from before the consent note waits for the button, which confirms it.
      if (!agreed) return;
      if (checkout === "success" && props.enabled) setPaid("waiting");
      setResume({ draft, paid: checkout === "success" });
    });
    // Once, on the page sign-in or checkout returned to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resume || !props.enabled || resumed.current || session.isPending) return;
    resumed.current = true;
    if (!session.data) void askToSignIn(resume.draft, resume.paid);
    // Sending starts here, as the plain send below does.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (resume.paid) void sendPaid(resume.draft);
    else void send(resume.draft).then((outcome) => outcome && paywall(resume.draft));
    // send reads only props, refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, props.enabled, session.isPending, session.data]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(quality);
  }

  // The button and the free preview's link both start here; pressing either
  // confirms the consent the note under the button states.
  function start(picked: Quality) {
    if (!ready || !photo) return;
    const draft = { photos: [photo], fields: { [CONSENT]: "yes", [QUALITY]: picked, [RATIO]: VERTICAL } };
    track("generate_clicked", { quality: picked, ratio: VERTICAL });
    setPaid(null);
    // A session still loading goes out too; a 401 asks to sign in.
    if (!session.data && !session.isPending) void askToSignIn(draft);
    else void send(draft).then((outcome) => outcome && paywall(draft));
  }

  async function share() {
    const url = `${window.location.origin}/${locale}`;
    if (navigator.share) {
      // Closing the share sheet rejects; there is nothing to report.
      await navigator.share({ title: tt("share.title"), text: tt("share.text"), url }).then(
        () => track("video_shared", { method: "native" }),
        () => {},
      );
      return;
    }
    await navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        track("video_shared", { method: "copy" });
      },
      () => {},
    );
  }

  return (
    <section
      id="generator"
      aria-labelledby="generator-title"
      className="flex min-w-0 scroll-mt-24 flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="generator-title" className="font-display text-lg font-semibold">
          {tt("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{tt("body")}</p>
      </div>

      {video && <Result video={video} copied={copied} onShare={share} onReset={() => setVideo(null)} />}

      {/* Hidden, not unmounted, while a video shows: the picked file stays in its input. */}
      <form onSubmit={submit} hidden={video !== null} className="flex flex-col gap-5">
        {!props.enabled && <p className="text-sm text-muted-foreground">{t("disabled")}</p>}
        <fieldset disabled={!props.enabled} className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label id="tryout-photo-label" htmlFor="tryout-photo">
              {t("left.photo")}
            </Label>
            {/* Hidden behind the zone below, which is its label: the zone
                takes clicks and drops, and shows focus for the keyboard. */}
            <input
              id="tryout-photo"
              type="file"
              accept={PHOTO_TYPES.join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file) track("photo_selected");
                pick("left", file);
              }}
              aria-labelledby="tryout-photo-label"
              aria-describedby="tryout-hint"
              className="peer sr-only"
            />
            <label
              htmlFor="tryout-photo"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (!props.enabled || !file) return;
                if (!PHOTO_TYPES.includes(file.type)) {
                  setOffer(null);
                  setError(t("errors.invalid", messageValues));
                  return;
                }
                track("photo_selected");
                pick("left", file);
              }}
              className="flex min-w-0 cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-border p-4 transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 sm:p-5 [@media(hover:hover)]:hover:border-primary-text/60 [@media(hover:hover)]:hover:bg-primary-text/5"
            >
              {previews.left ? (
                // A local object URL, which next/image can't optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews.left}
                  alt={t("left.preview")}
                  className="size-16 shrink-0 rounded-lg border bg-muted object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Plus className="size-6" />
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{photo ? photo.name : tt("photo.choose")}</span>
                <span className="text-sm text-muted-foreground">{photo ? tt("photo.change") : tt("photo.hint")}</span>
              </span>
            </label>
            <p id="tryout-hint" className="text-sm text-muted-foreground">
              {t("photoHint", { size })}
            </p>
          </div>
          <div role="radiogroup" aria-labelledby="tryout-quality" className="flex flex-col gap-2">
            <p id="tryout-quality" className="text-sm font-medium">
              {tt("quality.legend")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CHOICES.map((choice) => (
                <label
                  key={choice}
                  className="flex min-w-0 cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm has-checked:border-primary-text has-checked:bg-primary-text/5 has-disabled:cursor-not-allowed has-disabled:opacity-50 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)] [@media(hover:hover)]:has-checked:hover:border-primary-text"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <input
                      type="radio"
                      name="tryout-quality"
                      value={choice}
                      checked={quality === choice}
                      onChange={() => setQuality(choice)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="font-display font-semibold">{tt(`quality.${choice}.label`)}</span>
                    <span className="text-muted-foreground tabular-nums">{tt("quality.credits", { count: price(choice) })}</span>
                  </span>
                  <span className="text-pretty text-muted-foreground">{tt(`quality.${choice}.description`)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              type="submit"
              size="lg"
              variant={offer ? "outline" : "default"}
              className="w-full"
              disabled={!ready || submitting || paid === "waiting"}
            >
              <Sparkles />
              {submitting ? t("generating") : t("generate", { count: credits })}
            </Button>
            <p className="text-center text-xs text-pretty text-muted-foreground">{tt("consentNote")}</p>
            <button
              type="button"
              onClick={() => start("preview")}
              disabled={!ready || submitting || paid === "waiting"}
              className="text-sm font-medium text-primary-text underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
            >
              {tt("preview.button")}
            </button>
            <p className="text-center text-xs text-muted-foreground">{tt("preview.note")}</p>
          </div>
        </fieldset>
        {paid && (
          <p role="status" className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-pretty">
            {paid === "waiting" && (
              <LoaderCircle className="mt-0.5 shrink-0 animate-spin text-primary-text motion-reduce:animate-none" />
            )}
            {tt(`paid.${paid}`)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {offer && pack && (
          <PackOffer
            packs={props.packs}
            picked={pack.id}
            prices={{ standard: props.credits, pro: props.proCredits }}
            onPick={setPackId}
            onPay={buy}
            buying={buying}
            disabled={!ready || buying}
            error={buyError}
          >
            {offer === "short" ? (
              <p role="alert" className="text-sm text-destructive">
                {tt("credits", { credits })}
              </p>
            ) : (
              <p role="status" className="text-sm font-medium">
                {tt("packs.canceled")}
              </p>
            )}
          </PackOffer>
        )}
      </form>

      <Dialog open={signIn !== null} onOpenChange={(open) => !open && setSignIn(null)}>
        <DialogContent closeLabel={tt("close")}>
          <DialogHeader>
            <DialogTitle>{tt("signIn.title")}</DialogTitle>
            <DialogDescription>{tt("signIn.body")}</DialogDescription>
          </DialogHeader>
          {signIn && (
            <LoginForm returnTo={signIn} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// The packs on offer when credits run short, as a radio group with one pay
// button. Checkout is the provider's page.
function PackOffer({
  packs,
  picked,
  prices,
  onPick,
  onPay,
  buying,
  disabled,
  error,
  children,
}: {
  packs: readonly Pack[];
  picked: string;
  prices: VideoPrices;
  onPick: (id: string) => void;
  onPay: () => void;
  buying: boolean;
  disabled: boolean;
  error: string | null;
  // Why the packs show: the 402 message or the canceled checkout.
  children: React.ReactNode;
}) {
  const tt = useTranslations("HomeTryout");
  const format = useFormatter();
  const buys = usePackBuys(prices);
  // Amounts are in the currency's smallest unit; packs use two-decimal currencies.
  const price = (pack: Pack) =>
    format.number(pack.amount / 100, { style: "currency", currency: pack.currency.toUpperCase() });
  const chosen = packs.find((pack) => pack.id === picked) ?? packs[0];

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4">
      <div className="flex flex-col gap-1">
        {children}
        <p className="text-sm text-pretty text-muted-foreground">{tt("packs.body")}</p>
      </div>
      <div role="radiogroup" aria-labelledby="tryout-packs" className="flex flex-col gap-2">
        <p id="tryout-packs" className="text-sm font-medium">
          {tt("packs.legend")}
        </p>
        {packs.map((pack) => (
          <label
            key={pack.id}
            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm has-checked:border-primary-text has-checked:bg-primary-text/5 has-disabled:cursor-not-allowed has-disabled:opacity-50 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)] [@media(hover:hover)]:has-checked:hover:border-primary-text"
          >
            <input
              type="radio"
              name="tryout-pack"
              value={pack.id}
              checked={pack.id === chosen.id}
              onChange={() => onPick(pack.id)}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display font-semibold">{tt("quality.credits", { count: pack.credits })}</span>
              <span className="text-pretty text-muted-foreground">{buys(pack.credits)}</span>
            </span>
            <span className="shrink-0 font-display font-semibold tabular-nums">{price(pack)}</span>
          </label>
        ))}
      </div>
      <Button type="button" size="lg" className="w-full" disabled={disabled} onClick={onPay}>
        <CreditCard />
        {buying ? tt("packs.paying") : tt("packs.pay", { price: price(chosen) })}
      </Button>
      <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
        <LockKeyhole className="mt-px size-3.5 shrink-0" />
        {tt("packs.note")}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// The sent video: progress while it renders, then the player with download
// and share, or the refund once it failed.
function Result({
  video,
  copied,
  onShare,
  onReset,
}: {
  video: GeneratedVideo;
  copied: boolean;
  onShare: () => void;
  onReset: () => void;
}) {
  const tt = useTranslations("HomeTryout");

  if (video.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="text-sm text-destructive">
          {tt("failed", { credits: video.credits })}
        </p>
        <Button type="button" variant="outline" onClick={onReset}>
          {tt("tryAgain")}
        </Button>
      </div>
    );
  }

  if (!video.url) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 px-5 py-10 text-center">
        <LoaderCircle aria-hidden className="size-6 animate-spin text-primary-text motion-reduce:animate-none" />
        <p className="font-display font-semibold">{tt("pending.title")}</p>
        <p className="max-w-[40ch] text-sm text-pretty text-muted-foreground">{tt("pending.body")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-display font-semibold">{tt("ready")}</p>
      {video.preview && <p className="text-sm text-pretty text-muted-foreground">{tt("previewNote")}</p>}
      <video
        src={video.url}
        poster={video.posterUrl ?? video.imageUrl ?? undefined}
        aria-label={tt("video")}
        controls
        playsInline
        preload="metadata"
        className={cn("rounded-xl border bg-muted", playerFrame(video.ratio))}
      />
      <div className="flex flex-wrap items-center gap-3">
        {/* The route answers with a file, so the browser stays on this page. */}
        <a
          href={`/api/videos/${video.id}/download`}
          download
          onClick={() => track("video_downloaded")}
          className={buttonVariants()}
        >
          <Download />
          {tt("download")}
        </a>
        <Button type="button" variant="outline" onClick={onShare}>
          <Share2 />
          {tt("share.button")}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          {tt("another")}
        </Button>
        {copied && (
          <span role="status" className="text-sm text-primary-text">
            {tt("share.copied")}
          </span>
        )}
      </div>
    </div>
  );
}
