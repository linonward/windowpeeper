import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// When each kind of operator alert last went out, so a kind sends at most
// once per ALERT_EVERY_MS however many servers or sweeps notice it.
export const alert = pgTable("alert", {
  kind: text("kind").primaryKey(),
  sentAt: timestamp("sent_at").notNull(),
});
