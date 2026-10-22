import { apiError } from "@/lib/api";
import { getSession, type Session } from "@/server/auth/session";
import { hitLimit } from "@/server/ratelimit";

export type RouteLimit = { name: string; max: number; windowMs: number };

type Handler<P> = (request: Request, context: { session: Session; params: P }) => Promise<Response>;

// Methods a cross-site form or fetch could use to change data.
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// Wraps a signed-in API route. In order:
// - 401 without a session.
// - 403 FORBIDDEN_ORIGIN when a cookie request that changes data doesn't
//   come from this app's own pages (Better Auth checks its own routes, and
//   SameSite cookies alone don't stop a sibling subdomain).
// - 429 RATE_LIMITED with Retry-After past `limit` hits per user.
// Then runs the handler with the session and the route's params.
export function withSession<P extends object = Record<string, never>>(
  handler: Handler<P>,
  { limit }: { limit?: RouteLimit } = {},
) {
  return async (request: Request, context?: { params: Promise<P> }): Promise<Response> => {
    const session = await getSession(request.headers);
    if (!session) return apiError("UNAUTHORIZED", 401);

    if (!SAFE_METHODS.includes(request.method) && !sameOrigin(request)) {
      return apiError("FORBIDDEN_ORIGIN", 403);
    }

    if (limit) {
      const hit = await hitLimit(`api:${limit.name}:${session.user.id}`, limit);
      if (!hit.allowed) return rateLimited(hit.retryAfterMs);
    }

    return handler(request, { session, params: (await context?.params) as P });
  };
}

function rateLimited(retryAfterMs: number): Response {
  const response = apiError("RATE_LIMITED", 429);
  response.headers.set("retry-after", String(Math.ceil(retryAfterMs / 1000)));
  return response;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === URL.parse(process.env.BETTER_AUTH_URL ?? "")?.origin;
}
