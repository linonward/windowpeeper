// @vitest-environment node
import { expect, test, vi } from "vitest";

vi.mock("project.config", () => ({ projectConfig: { name: "Acme & Co" } }));

const { magicLinkEmail } = await import("./magic-link");

const url = "https://acme.test/sign-in/confirm?token=abc&callbackURL=%2Fvideos";

test("names the project from project.config", () => {
  const email = magicLinkEmail("ada@example.com", url);

  // e2e/support/auth.ts finds the email by this subject.
  expect(email.subject).toBe("Sign in to Acme & Co");
  expect(email.text).toMatch(/^Sign in to Acme & Co\n/);
  expect(email.html).toContain("<title>Sign in to Acme &amp; Co</title>");
});

test("puts the link in both bodies: a button and the raw link to copy", () => {
  const email = magicLinkEmail("ada@example.com", url);
  const href = url.replace("&", "&amp;");

  expect(email.to).toBe("ada@example.com");
  expect(email.text).toContain(url);
  // The button and the copy-paste link.
  expect(email.html.split(`href="${href}"`)).toHaveLength(3);
  expect(email.html).toContain(`>${href}</a>`);
});

test("the text body's first URL is the sign-in link", () => {
  const email = magicLinkEmail("ada@example.com", url);

  // e2e/support/auth.ts reads the first URL in the text.
  expect(email.text.match(/https?:\/\/\S+/)?.[0]).toBe(url);
});

test("names the address and says the link works once, for 5 minutes", () => {
  const email = magicLinkEmail("ada+<x>@example.com", url);

  expect(email.html).toContain("ada+&lt;x&gt;@example.com");
  expect(email.text).toContain("ada+<x>@example.com");
  for (const body of [email.text, email.html]) {
    expect(body).toContain("The link works once and expires in 5 minutes.");
    expect(body).toContain("No one can sign in without the link.");
  }
});

test("the logo and the footer link come from the link's site", () => {
  const email = magicLinkEmail("ada@example.com", url);

  expect(email.html).toContain('src="https://acme.test/icon.png"');
  expect(email.html).toContain('href="https://acme.test"');
  expect(email.text).toContain("acme.test");
});

test("escapes the link in the HTML body", () => {
  const email = magicLinkEmail("ada@example.com", 'https://x.test/?a="><script>');

  expect(email.html).not.toContain("<script>");
  expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
});
