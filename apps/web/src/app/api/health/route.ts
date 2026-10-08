import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health: liveness check for the load balancer / smoke tests.
 * It only shows the process can handle requests; it deliberately skips the database and returns no internal info:
 * a blip in a dependency (Supabase etc.) shouldn't get the container declared dead and restarted over and over.
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
