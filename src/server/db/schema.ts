// Aggregates every module's Drizzle tables. Add new modules here, then run
// `pnpm db:generate --name <change>` and `pnpm db:migrate`.
export * from "@/server/auth/schema";
export * from "@/server/credits/schema";
export * from "@/server/payment/schema";
export * from "@/server/videos/schema";
export * from "@/server/notifications/schema";
export * from "@/server/feedback/schema";
export * from "@/server/alerts/schema";
export * from "./legacy-schema";
