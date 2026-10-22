// Project-wide settings that aren't secrets and don't change per environment.
// Client components import this file, so everything here ships to the
// browser. Admin emails live in ADMIN_EMAILS.
export const projectConfig = {
  name: "WindowPeeper",
  supportEmail: "support@windowpeeper.org",
} as const satisfies {
  name: string;
  supportEmail: string;
};
