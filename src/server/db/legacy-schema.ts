import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";
import { generationColumns } from "@/server/generations/columns";

// Tables of features the app no longer has: AI chat, text-to-image, API
// keys and admin broadcasts. No code writes them. They stay defined until a
// deliberate migration drops them, so the schema matches the migrations and
// `pnpm db:generate` finds no change. Chats, messages, images and their
// rows cascade with the user; afterDeleteUser (src/server/account) still
// deletes a user's API keys and stored images.

// One row per conversation. The browser picks the ID (a UUID) so the URL
// can change before the first reply; the server checks the owner.
export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The start of the first message.
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Bumped on every message, so the list shows recent chats first.
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("chat_userId_updatedAt_idx").on(table.userId, table.updatedAt)],
);

// Messages in the AI SDK's UIMessage format. IDs are unique per chat only,
// because the browser generates the user's message IDs.
export const chatMessage = pgTable(
  "chat_message",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    parts: jsonb("parts").notNull(),
    // Keeps messages in order, even when two land in the same millisecond.
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "chat_message_pk", columns: [table.chatId, table.id] }),
    index("chat_message_chatId_seq_idx").on(table.chatId, table.seq),
  ],
);

// One row per call to a chat model (chat replies, rap lyrics), for cost
// metrics. No user: costs are totals, and nothing here outlives an account.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    model: text("model").notNull(),
    // "chat" or "lyrics".
    purpose: text("purpose").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    // US dollars at the list price when the call ran; null for a model
    // without a price.
    costUsd: doublePrecision("cost_usd"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_usage_createdAt_idx").on(table.createdAt)],
);

// One row per generation. The PNG lives in object storage under storageKey.
export const image = pgTable(
  "image",
  {
    ...generationColumns(),
    prompt: text("prompt").notNull(),
    aspect: text("aspect").notNull(),
    // Bailian's task ID, set once the image is submitted.
    taskId: text("task_id"),
  },
  (table) => [
    index("image_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("image_pending_createdAt_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
  ],
);

// Better Auth's API key plugin's table. referenceId is the owner's user ID,
// without a foreign key.
export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(60000),
    rateLimitMax: integer("rate_limit_max").default(60),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ],
);

// A notification an admin sent. Each recipient gets a `broadcast`
// notification keyed `broadcast:<id>:<userId>`.
export const broadcast = pgTable(
  "broadcast",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    // One per form submission, so a double click sends once.
    requestId: text("request_id").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // The one recipient, or null for every user.
    email: text("email"),
    // The admin's email.
    sentBy: text("sent_by").notNull(),
    recipients: integer("recipients").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("broadcast_createdAt_idx").on(table.createdAt)],
);
