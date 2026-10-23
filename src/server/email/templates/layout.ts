import { projectConfig } from "project.config";
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

// A paragraph in the card. `html` is already escaped.
export const paragraph = (html: string, extra = "") =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.muted};${extra}">${html}</p>`;

// A name or address in a paragraph, in the brighter ink.
export const strong = (text: string) => `<strong style="color:${C.ink};">${escapeHtml(text)}</strong>`;

// The branded email: the lockup, a card with the title, the body, a lamp
// button and the link to copy, then a footer. The logo and the footer link
// point to the site of `url`. `body` and `after` are HTML paragraphs.
export function layout({
  title,
  preheader,
  body,
  action,
  url,
  after = [],
  note,
}: {
  title: string;
  preheader: string;
  body: string[];
  action: string;
  url: string;
  after?: string[];
  note?: string;
}) {
  const { name } = projectConfig;
  const { origin: site, host } = new URL(url);
  const link = escapeHtml(url);
  const small = `font-size:13px;line-height:20px;color:${C.faint};`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
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
<h1 style="margin:0 0 16px;font-family:${DISPLAY};font-size:32px;line-height:36px;font-weight:normal;color:${C.ink};">${escapeHtml(title)}</h1>
${body.join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td style="border-radius:10px;background:${C.lamp};">
<a href="${link}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:bold;color:${C.onLamp};text-decoration:none;border-radius:10px;">${escapeHtml(action)}</a>
</td></tr>
</table>
${after.join("\n")}
${paragraph("Button not working? Copy this link into your browser:", "margin-bottom:8px;font-size:14px;line-height:20px;")}
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;word-break:break-all;"><a href="${link}" style="color:${C.lampText};">${link}</a></p>
</td></tr>
<tr><td style="padding:24px 8px 0;">
${note ? paragraph(escapeHtml(note), small) : ""}
${paragraph(`${escapeHtml(name)} &middot; Window peeper AI video &middot; <a href="${site}" style="color:${C.faint};">${escapeHtml(host)}</a>`, `margin:0;${small}`)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// The text body's last line, matching the HTML footer.
export const textFooter = (url: string) => `${projectConfig.name} - Window peeper AI video - ${new URL(url).host}`;
