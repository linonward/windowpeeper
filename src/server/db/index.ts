import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema> & { $client: Pool };

let db: Database | undefined;

// A Cloudflare Worker can't use a socket another request opened, so there
// each request gets its own pool, keyed by its execution context. A server
// process shares one.
const perRequest = new WeakMap<object, Database>();

function inWorker() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

function connect(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  // An idle connection's socket closes when its request ends; pg reports
  // that as a pool error, which would otherwise crash the Worker.
  if (inWorker()) pool.on("error", () => {});
  return drizzle(pool, { schema });
}

function requestDb(): Database {
  const { ctx } = getCloudflareContext();
  let found = perRequest.get(ctx);
  if (!found) {
    found = connect();
    perRequest.set(ctx, found);
  }
  return found;
}

// In a Worker, callers may keep the client past one request (Better Auth
// gets it once, at startup), so it forwards each use to the current
// request's.
const workerDb = new Proxy({} as Database, {
  get(_, key) {
    const current = requestDb();
    const value = Reflect.get(current, key, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});

export function getDb(): Database {
  return inWorker() ? workerDb : (db ??= connect());
}

// The client or an open transaction, for functions that can join the
// caller's transaction.
export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
