import { adminReplySchema } from "@feedbackport/core";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/admin/feedback/:id/reply: write an admin reply (is_admin = true).
 * Likewise no direct notification; a DB webhook triggers notify-submitter asynchronously (see docs/ARCHITECTURE.md).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("replies")
    .insert({ feedback_id: id, body: parsed.data.body, is_admin: true })
    .select("id, body, is_admin, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "failed to save reply" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
