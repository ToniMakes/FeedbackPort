import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/drafts/:id/publish: turn a pending draft into an admin reply.
 *
 * The work is done by the `publish_reply_draft` SQL function, which flips the draft's status and
 * inserts the reply in one transaction. A second call (double click, two tabs) finds no pending
 * draft and returns 409, so a draft can never produce two replies or two emails. The insert into
 * `replies` is what fires the existing notify-submitter webhook, exactly like a hand-written reply.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("publish_reply_draft", { draft_id: id });
  if (error) {
    return NextResponse.json({ error: "failed to publish draft" }, { status: 500 });
  }
  if (data === null) {
    return NextResponse.json({ error: "draft is not pending" }, { status: 409 });
  }

  return NextResponse.json({ replyId: data }, { status: 201 });
}
