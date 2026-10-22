import { localePath, type Locale } from "@/i18n/routing";
// A path on this site: one leading slash, and no second slash, backslash or
// control character that a browser could turn into another host
// ("//evil.example", "/\evil.example", "/\t/evil.example").
const SITE_PATH = /^\/(?![/\\])[^\\\u0000-\u001f]*$/;

// Where sign-in returns to: the `next` page the proxy passed along, if it is
// a path on this site, else the videos page.
export function signInReturnPath(next: string | null, locale: string): string {
  return next && SITE_PATH.test(next) ? next : localePath(locale as Locale, "/videos");
}
