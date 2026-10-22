import { hasLocale } from "next-intl";
import { withSession } from "@/app/api/_lib/with-session";
import { routing, localePath } from "@/i18n/routing";
import { apiError, type RedirectResponse } from "@/lib/api";
import { log } from "@/server/log";
import { createCheckout, PaymentsDisabledError, UnknownPackError } from "@/server/payment/orders";

// Where checkout sends the buyer back to, by `returnTo`: the home page's
// generator, which then makes the video it was bought for, or billing.
// Only these two; any other value, URLs included, means billing.
const RETURNS = {
  billing: { path: "/billing", query: "", hash: "" },
  home: { path: "", query: "&try=1", hash: "#generator" },
};

// Starts a checkout for a credit pack. Body: { packId, locale, returnTo? }.
// Returns { url } to send the browser to.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const packId = typeof body.packId === "string" ? body.packId : "";
  const locale = hasLocale(routing.locales, body.locale) ? body.locale : routing.defaultLocale;
  const back = body.returnTo === "home" ? RETURNS.home : RETURNS.billing;
  const page = new URL(localePath(locale, back.path), process.env.BETTER_AUTH_URL ?? request.url);

  try {
    const url = await createCheckout({
      userId: session.user.id,
      email: session.user.email,
      packId,
      locale,
      successUrl: `${page}?checkout=success${back.query}${back.hash}`,
      cancelUrl: `${page}?checkout=cancel${back.query}${back.hash}`,
    });
    return Response.json({ url } satisfies RedirectResponse);
  } catch (error) {
    if (error instanceof UnknownPackError) {
      return apiError("UNKNOWN_PACK", 400);
    }
    if (error instanceof PaymentsDisabledError) {
      return apiError("PAYMENTS_DISABLED", 503);
    }
    log.error("payment.checkout_failed", { userId: session.user.id, packId, error });
    return apiError("CHECKOUT_FAILED", 502);
  }
});
