import { projectConfig } from "project.config";
import type { Email } from "@/server/email/client";
import { escapeHtml } from "./escape";
import { layout, paragraph, strong, textFooter } from "./layout";

// Better Auth's default for magic links (expiresIn, 300 s).
const EXPIRY = "The link works once and expires in 5 minutes.";
const IGNORE = "If you didn't ask for this, you can ignore this email. No one can sign in without the link.";

// The sign-in email. `url` is the confirm link (src/server/auth/magic-link.ts).
export function magicLinkEmail(to: string, url: string): Email {
  const { name } = projectConfig;
  const action = `Sign in to ${name}`;

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
      textFooter(url),
    ].join("\n"),
    html: layout({
      title: action,
      preheader: EXPIRY,
      body: [
        paragraph(
          `Someone asked to sign in to ${escapeHtml(name)} as ${strong(to)}. Press the button to finish signing in.`,
        ),
      ],
      action,
      url,
      after: [paragraph(EXPIRY)],
      note: IGNORE,
    }),
  };
}
