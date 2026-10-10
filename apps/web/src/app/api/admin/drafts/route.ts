import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DRAFT_STATUSES = ["pending", "published", "rejected"] as const;

interface DraftRow {
  id: string;
  feedback_id: string;
  body: string;
  rationale: string | null;
  contains_links: boolean;
  status: string;
  source: string;
  created_at: string;
  feedback: {
    id: string;
    title: string;
    body: string | null;
    status: string;
    products: { slug: string; name: string } | null;
  } | null;
}

/**
 * GET /api/admin/drafts?status=pending: AI-drafted replies waiting for review (see docs/MCP.md).
 * Drafts live in `reply_drafts`, not `replies`, so none of them has been sent or emailed yet.
 * The submitter's email is deliberately not returned; the console only needs to say that a
 * published reply emails the submitter.
 */
export async function GET(request: NextRequest) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  if (!DRAFT_STATUSES.includes(status as (typeof DRAFT_STATUSES)[number])) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("reply_drafts")
    .select(
      "id, feedback_id, body, rationale, contains_links, status, source, created_at, feedback:feedback_id(id, title, body, status, products(slug, name))",
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<DraftRow[]>();

  if (error) {
    return NextResponse.json({ error: "failed to list drafts" }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}
