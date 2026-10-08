import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/feedback/:id —— 反馈详情 + 关联回复，见 docs/API.md。
 * id 是不可预测的 UUID，读取单条不做租户强校验（跟 docs/API.md 保持一致）。
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
