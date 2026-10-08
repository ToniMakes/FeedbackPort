import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/feedback/:id: feedback detail plus its replies; see docs/API.md.
 * The id is an unguessable UUID, so reading a single item does no strict tenant check (consistent with docs/API.md).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: feedback, error: feedbackError } = await getSupabaseAdmin()
    .from("feedback")
    .select("id, product_id, title, body, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (feedbackError) {
    return NextResponse.json({ error: "failed to load feedback" }, { status: 500 });
  }
  if (!feedback) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: replies, error: repliesError } = await getSupabaseAdmin()
    .from("replies")
    .select("id, body, is_admin, created_at")
    .eq("feedback_id", id)
    .order("created_at", { ascending: true });

  if (repliesError) {
    return NextResponse.json({ error: "failed to load replies" }, { status: 500 });
  }

  return NextResponse.json({ ...feedback, replies });
}
