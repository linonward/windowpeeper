import { connection } from "next/server";
import type { EffectsEnabledResponse } from "@/lib/api";
import { effectOptions } from "@/server/videos";

// GET /api/videos/enabled returns { enabled }: whether the photo effects are
// set up (Bailian and storage). Public, for the prerendered home page, whose
// build doesn't see the Worker's secrets. Read per request, never prerendered.
export async function GET() {
  await connection();

  return Response.json({ enabled: effectOptions("windowpeeper").enabled } satisfies EffectsEnabledResponse);
}
