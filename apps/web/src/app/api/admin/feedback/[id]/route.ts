import { adminUpdateFeedbackSchema } from "@feedbackport/core";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * PATCH /api/admin/feedback/:id: change status or assign a duplicate target.
 * No notification is sent directly after a successful write; a DB webhook triggers notify-submitter asynchronously (see docs/ARCHITECTURE.md).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminUpdateFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const update: { status?: string; duplicate_of?: string } = {};
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.duplicateOf) update.duplicate_of = parsed.data.duplicateOf;

  const { data, error } = await getSupabaseAdmin()
    .from("feedback")
    .update(update)
    .eq("id", id)
    .select("id, status, duplicate_of")
    .single();

  if (error) {
    return NextResponse.json({ error: "failed to update feedback" }, { status: 500 });
  }

  return NextResponse.json(data);
}
