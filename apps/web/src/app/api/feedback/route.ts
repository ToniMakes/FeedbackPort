import { FEEDBACK_STATUSES, submitFeedbackSchema } from "@feedbackport/core";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProductBySlug } from "@/lib/tenant";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { publicPostCorsPreflight, withPublicPostCors } from "@/lib/public-post-cors";

/**
 * GET /api/feedback —— board 调用（同源），租户由中间件从子域名解析后写进
 * x-tenant-slug 请求头，见 docs/ARCHITECTURE.md「多租户路由设计」。
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
  // TODO: sort=votes 应按投票数排序，需要额外的聚合视图，先按最新排序占位，见 docs/ROADMAP.md
  let query = getSupabaseAdmin()
    .from("feedback")
    .select("id, title, body, status, submitter_email, created_at, votes(count)")
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
 * POST /api/feedback —— widget 提交反馈的入口（跨域，见 docs/API.md）。
 *
 * 处理顺序（见 docs/ARCHITECTURE.md「提交反馈」数据流）：
 *   zod schema 校验（要先解析出各字段才能往下走）→ 蜜罐检查 → Turnstile 校验
 *   → IP 频率限制（Redis）→ 按 productSlug 解析租户 → 写入 feedback 表
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = submitFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return withPublicPostCors(NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }));
  }

  const { productSlug, title, body: feedbackBody, submitterEmail, turnstileToken, honeypot } =
    parsed.data;

  // 蜜罐字段被填了 = 大概率是脚本，静默假装成功，不告诉对方判定逻辑
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
