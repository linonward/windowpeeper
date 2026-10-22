// The magic link we email opens /sign-in/confirm, which spends the token only
// when the visitor presses a button. Email scanners and temporary inboxes open
// links on their own; a link straight to Better Auth's verify endpoint would
// sign them in and leave the visitor an expired link. The confirm page keeps
// the query (token, callbackURL), and the verify endpoint still checks it.
export function confirmLink(verifyUrl: string): string {
  const verify = new URL(verifyUrl);
  const confirm = new URL("/sign-in/confirm", verify.origin);
  confirm.search = verify.search;
  return confirm.toString();
}
