import type { Email } from "@/server/email/client";
import { escapeHtml } from "./escape";
import { layout, paragraph, textFooter } from "./layout";

// A one-paragraph email with one link to act on, in the sign-in email's
// layout: the subject is its title and the action its button.
export function actionEmail(to: string, subject: string, body: string, action: string, url: string): Email {
  return {
    to,
    subject,
    text: `${body}\n\n${action}: ${url}\n\n${textFooter(url)}`,
    html: layout({ title: subject, preheader: body, body: [paragraph(escapeHtml(body))], action, url }),
  };
}
