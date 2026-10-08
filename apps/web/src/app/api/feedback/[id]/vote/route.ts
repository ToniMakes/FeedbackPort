import { voteFromWidgetSchema } from "@feedbackport/core";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProductBySlug } from "@/lib/tenant";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { publicPostCorsPreflight, withPublicPostCors } from "@/lib/public-post-cors";

/**
 * POST /api/feedback/:id/vote: always requires productSlug (board and widget aren't distinguished),
 * used to double-check before the write that the feedback really belongs to this tenant; see the "Voting" data flow in docs/ARCHITECTURE.md.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = voteFromWidgetSchema.safeParse(body);

  if (!parsed.success) {
    return withPublicPostCors(NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }));
  }

  const { productSlug, voterEmail, turnstileToken } = parsed.data;

  const ip = getClientIp(request);

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return withPublicPostCors(NextResponse.json({ error: "turnstile verification failed" }, { status: 403 }));
  }

  const withinLimit = await checkRateLimit("vote", await hashIp(ip));
  if (!withinLimit) {
    return withPublicPostCors(NextResponse.json({ error: "too many requests" }, { status: 429 }));
  }

  const product = await getProductBySlug(productSlug);
  if (!product) {
    return withPublicPostCors(NextResponse.json({ error: "unknown product" }, { status: 404 }));
  }

  const supabase = getSupabaseAdmin();

  const { data: feedback, error: feedbackError } = await supabase
    .from("feedback")
    .select("id, product_id")
    .eq("id", id)
    .maybeSingle();

  if (feedbackError) {
    return withPublicPostCors(NextResponse.json({ error: "failed to load feedback" }, { status: 500 }));
  }
  if (!feedback || feedback.product_id !== product.id) {
    return withPublicPostCors(NextResponse.json({ error: "not found" }, { status: 404 }));
  }

  const { error: voteError } = await supabase
    .from("votes")
    .insert({ feedback_id: id, voter_email: voterEmail });

  if (voteError) {
    // 23505 = unique_violation, i.e. (feedback_id, voter_email) already exists; see docs/DATA_MODEL.md
    if (voteError.code === "23505") {
      return withPublicPostCors(NextResponse.json({ alreadyVoted: true }, { status: 200 }));
    }
    return withPublicPostCors(NextResponse.json({ error: "failed to vote" }, { status: 500 }));
  }

  return withPublicPostCors(NextResponse.json({ alreadyVoted: false }, { status: 201 }));
}

export async function OPTIONS() {
  return publicPostCorsPreflight();
}
