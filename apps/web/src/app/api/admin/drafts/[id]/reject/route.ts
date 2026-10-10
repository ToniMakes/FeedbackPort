import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/admin/drafts/:id/reject: discard a pending draft. Nothing is sent. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("reject_reply_draft", { draft_id: id });
  if (error) {
    return NextResponse.json({ error: "failed to reject draft" }, { status: 500 });
  }
  if (data !== true) {
    return NextResponse.json({ error: "draft is not pending" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
