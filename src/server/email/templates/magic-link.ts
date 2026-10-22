import { projectConfig } from "project.config";
import type { Email } from "@/server/email/client";
import { escapeHtml } from "./escape";

// The site's night colors (src/app/globals.css). Email clients ignore
// stylesheets and CSS variables, so the layout is tables with inline styles,
// and the logo is the site's hosted icon.
const C = {
  bg: "#090c13",
  card: "#11151f",
  ink: "#f3eee4",
  muted: "#98a0b3",
  faint: "#646c80",
  line: "#252b3a",
  lamp: "#ffb445",
  onLamp: "#1b1206",
  lampText: "#ffc877",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY = "Impact, 'Arial Narrow', Arial, sans-serif";
// Better Auth's default for magic links (expiresIn, 300 s).
const EXPIRY = "The link works once and expires in 5 minutes.";
const IGNORE = "If you didn't ask for this, you can ignore this email. No one can sign in without the link.";

// The sign-in email: the lockup, a card with a lamp button and the link to
// copy, and a footer. `url` is the confirm link (src/server/auth/magic-link.ts);
// the logo and the footer link point to its site.
export function magicLinkEmail(to: string, url: string): Email {
  const { name } = projectConfig;
  const site = new URL(url).origin;
  const host = new URL(url).host;
  const action = `Sign in to ${name}`;
  const link = escapeHtml(url);
  const p = (text: string, extra = "") =>
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.muted};${extra}">${text}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(action)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${EXPIRY}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 8px 24px;">
<a href="${site}" style="text-decoration:none;">
<img src="${site}/icon.png" width="32" height="32" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:6px;">
<span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${DISPLAY};font-size:22px;letter-spacing:1px;text-transform:uppercase;color:${C.ink};">${escapeHtml(name)}</span>
</a>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:40px 32px;">
<h1 style="margin:0 0 16px;font-family:${DISPLAY};font-size:32px;line-height:36px;font-weight:normal;color:${C.ink};">${escapeHtml(action)}</h1>
${p(`Someone asked to sign in to ${escapeHtml(name)} as <strong style="color:${C.ink};">${escapeHtml(to)}</strong>. Press the button to finish signing in.`)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td style="border-radius:10px;background:${C.lamp};">
<a href="${link}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:bold;color:${C.onLamp};text-decoration:none;border-radius:10px;">${escapeHtml(action)}</a>
</td></tr>
</table>
${p(EXPIRY)}
${p("Button not working? Copy this link into your browser:", "margin-bottom:8px;font-size:14px;line-height:20px;")}
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;word-break:break-all;"><a href="${link}" style="color:${C.lampText};">${link}</a></p>
</td></tr>
<tr><td style="padding:24px 8px 0;">
${p(escapeHtml(IGNORE), `font-size:13px;line-height:20px;color:${C.faint};`)}
${p(`${escapeHtml(name)} &middot; Window peeper AI video &middot; <a href="${site}" style="color:${C.faint};">${escapeHtml(host)}</a>`, `margin:0;font-size:13px;line-height:20px;color:${C.faint};`)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return {
    to,
    subject: action,
    text: [
      action,
      "",
      `Someone asked to sign in to ${name} as ${to}. Open this link to finish signing in:`,
      "",
      url,
      "",
      EXPIRY,
      IGNORE,
      "",
      `${name} - Window peeper AI video - ${host}`,
    ].join("\n"),
    html,
  };
}
