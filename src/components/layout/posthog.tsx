"use client";

import { useEffect, useRef } from "react";
import { analyticsEnabled, distinctIdOf, resolveIdentity, send } from "@/lib/analytics";
import { authClient } from "@/lib/auth-client";
import { landingProperties } from "@/lib/first-touch";
import { GUIDES } from "@/lib/guides";
import { photoEffectKinds } from "@/lib/photo-effects";
import { routing } from "@/i18n/routing";
// Analytics needs the locale-prefixed URL, not the locale-stripped navigation helper.
// eslint-disable-next-line no-restricted-imports
import { usePathname } from "next/navigation";

// Only route names leave the browser. Unknown segments can contain IDs or
// user input, including on 404 pages. Never send search or hash. The landing
// page view also carries its utm_ tags and referring site (host and path),
// so PostHog can count sources; the first touch (src/lib/first-touch.ts)
// goes as $set_once, sanitized.
const ROUTES = new Set([
  "", ...GUIDES, "pricing", "privacy", "terms", "refund", "sign-in",
  "dashboard", "videos", "videos/library", ...photoEffectKinds.map((kind) => `videos/${kind}`),
  "feedback", "billing", "profile", "admin",
  "admin/users", "admin/orders", "admin/metrics", "admin/feedback", "blog",
]);
function routeName(pathname: string) {
  const [, language, ...parts] = pathname.split("/");
  const locale = (routing.locales as readonly string[]).includes(language) ? language : "unknown";
  const path = parts.join("/").replace(/\/$/, "");
  if (ROUTES.has(path)) return `/${locale}${path ? `/${path}` : ""}`;
  for (const prefix of ["videos", "admin/users", "blog/tags", "blog"]) {
    if (path.startsWith(`${prefix}/`)) return `/${locale}/${prefix}/:id`;
  }
  return `/${locale}/:other`;
}

export function PostHogPageviews() {
  if (!analyticsEnabled()) return null;
  return <TrackedPageviews />;
}

function TrackedPageviews() {
  const pathname = usePathname();
  const { data: session, isPending, error } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const linked = useRef<string | null>(null);
  const previous = useRef<string | null>(null);
  // The first page view of this page load is the landing.
  const landed = useRef(false);
  useEffect(() => {
    if (!analyticsEnabled() || !pathname || isPending || error) return;
    const identity = resolveIdentity(userId);
    const distinctId = distinctIdOf(identity);
    const link = `${identity.anonymous}:${distinctId}`;
    if (userId && linked.current !== link) {
      linked.current = link;
      void send("$identify", identity, { $anon_distinct_id: identity.anonymous }).then((response) => {
        if (!response.ok && linked.current === link) linked.current = null;
      }).catch(() => { if (linked.current === link) linked.current = null; });
    }
    const page = `${distinctId}:${pathname}`;
    if (previous.current === page) return;
    previous.current = page;
    const path = routeName(pathname);
    const landing = landed.current ? {} : landingProperties();
    landed.current = true;
    void send("$pageview", identity, { ...landing, $pathname: path, $current_url: `${window.location.origin}${path}`,
      $host: window.location.host }).catch(() => {});
  }, [pathname, userId, isPending, error]);
  return null;
}
