import { SessionAccount } from "@/components/layout/session-account";
import { AccountLink } from "@/components/layout/site-header";

// The site header's account button. The browser checks the session, so the
// pages around it stay prerendered; the server renders both labels.
export function SiteAccount() {
  return <SessionAccount signedOut={<AccountLink signedIn={false} />} signedIn={<AccountLink signedIn />} />;
}
