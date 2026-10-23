"use client";

import { authClient } from "@/lib/auth-client";

// The site header's account button, picked in the browser so the pages
// around it stay prerendered: reading the request on the server would
// render every page per request. Shows `signedOut` until the session loads,
// as most visitors to public pages are signed out.
export function SessionAccount({ signedOut, signedIn }: { signedOut: React.ReactNode; signedIn: React.ReactNode }) {
  const { data } = authClient.useSession();
  return data ? signedIn : signedOut;
}
