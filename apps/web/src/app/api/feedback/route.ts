import { FEEDBACK_STATUSES, submitFeedbackSchema } from "@feedbackport/core";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProductBySlug } from "@/lib/tenant";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { publicPostCorsPreflight, withPublicPostCors } from "@/lib/public-post-cors";

/**
 * GET /api/feedback: called by the board (same-origin). Middleware resolves the tenant from the subdomain
 * and writes it to the x-tenant-slug request header; see docs/ARCHITECTURE.md, "Multi-tenant routing design".
 */
export async function GET(request: NextRequest) {
  const tenantSlug = request.headers.get("x-tenant-slug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "missing tenant" }, { status: 400 });
  }

  const product = await getProductBySlug(tenantSlug);
  if (!product) {
    return NextResponse.json({ error: "unknown product" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  if (statusFilter && !FEEDBACK_STATUSES.includes(statusFilter as (typeof FEEDBACK_STATUSES)[number])) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  // Always newest first; the board sorts by vote count client-side (the list is not paginated yet)
  let query = getSupabaseAdmin()
    .from("feedback")
    .select("id, title, body, status, created_at, votes(count)")
    .eq("product_id", product.id)
    .is("duplicate_of", null)
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "failed to list feedback" }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

/**
 * POST /api/feedback: entry point for widget feedback submissions (cross-origin; see docs/API.md).
 *
 * Processing order (see the "Submitting feedback" data flow in docs/ARCHITECTURE.md):
 *   zod schema validation (fields must be parsed first) → honeypot check → Turnstile verification
 *   → IP rate limit (Redis) → resolve the tenant by productSlug → insert into feedback
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = submitFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return withPublicPostCors(NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }));
  }

  const { productSlug, title, body: feedbackBody, submitterEmail, turnstileToken, honeypot } =
    parsed.data;

  // A filled honeypot almost certainly means a script: silently pretend it worked and don't reveal the detection logic
  if (honeypot) {
    return withPublicPostCors(NextResponse.json({ id: "ignored", status: "open" }, { status: 201 }));
  }

  const ip = getClientIp(request);

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return withPublicPostCors(NextResponse.json({ error: "turnstile verification failed" }, { status: 403 }));
  }

  const withinLimit = await checkRateLimit("submitFeedback", await hashIp(ip));
  if (!withinLimit) {
    return withPublicPostCors(NextResponse.json({ error: "too many requests" }, { status: 429 }));
  }

  const product = await getProductBySlug(productSlug);
  if (!product) {
    return withPublicPostCors(NextResponse.json({ error: "unknown product" }, { status: 404 }));
  }

  const { data, error } = await getSupabaseAdmin()
    .from("feedback")
    .insert({
      product_id: product.id,
      title,
      body: feedbackBody ?? null,
      submitter_email: submitterEmail,
    })
    .select("id, status")
    .single();

  if (error) {
    return withPublicPostCors(NextResponse.json({ error: "failed to save feedback" }, { status: 500 }));
  }

  return withPublicPostCors(NextResponse.json({ id: data.id, status: data.status }, { status: 201 }));
}

export async function OPTIONS() {
  return publicPostCorsPreflight();
}
