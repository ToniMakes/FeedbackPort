// Deno Edge Function，由 Supabase Database Webhook 触发，不被业务代码直接调用。
// 契约见 docs/API.md「事件驱动通知契约」；解耦设计动机见 docs/ARCHITECTURE.md「关键解耦点」。
// Webhook triggers and their per-project Vault configuration are installed by
// the repeatable migration and infra/Configure-SupabaseDatabaseWebhooks.ps1.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "replies" | "feedback";
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface NotificationPlan {
  recipients: Set<string>;
  subject: string;
  text: string;
}

Deno.serve(async (req: Request) => {
  // 关掉了 Supabase 的 "Verify JWT" 开关（那个验证的是 Supabase 自己签发的 JWT，
  // 新版 sb_secret_ 密钥体系下不一定能满足），改用共享密钥自己把关——
  // 没有这一步，任何知道这个 URL 的人都能伪造 webhook 请求体，
  // 拿你的 Resend 账号当垃圾邮件转发器给任意地址发信。
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const plan = await buildNotificationPlan(supabase, payload);
  if (!plan) {
    return jsonResponse({ skipped: true });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    // 没配 Resend key 时不让整个 webhook 报错阻塞，只记录跳过——
    // 自部署的人如果暂时不想接邮件，功能其余部分不受影响
    console.warn("RESEND_API_KEY not set, skipping email send");
    return jsonResponse({ skipped: true, reason: "no RESEND_API_KEY" });
  }

  const fromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "notifications@feedbackport.example.com";

  const results = await Promise.allSettled(
    Array.from(plan.recipients).map((to) => sendEmail(resendApiKey, fromEmail, to, plan.subject, plan.text)),
  );
  const failed = results.filter((r) => r.status === "rejected").length;

  return jsonResponse({ ok: true, notified: plan.recipients.size, failed });
});

async function buildNotificationPlan(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  payload: WebhookPayload,
): Promise<NotificationPlan | null> {
  if (payload.table === "replies" && payload.type === "INSERT" && payload.record.is_admin === true) {
    const { data: feedback } = await supabase
      .from("feedback")
      .select("title, submitter_email")
      .eq("id", payload.record.feedback_id)
      .maybeSingle();

    if (!feedback) return null;

    return {
      recipients: new Set([feedback.submitter_email as string]),
      subject: `你的反馈「${feedback.title}」有新回复`,
      text: String(payload.record.body ?? ""),
    };
  }

  if (
    payload.table === "feedback" &&
    payload.type === "UPDATE" &&
    payload.record.status !== payload.old_record?.status
  ) {
    const recipients = new Set<string>([payload.record.submitter_email as string]);

    const { data: votes } = await supabase
      .from("votes")
      .select("voter_email")
      .eq("feedback_id", payload.record.id);

    // deno-lint-ignore no-explicit-any
    votes?.forEach((vote: any) => recipients.add(vote.voter_email));

    return {
      recipients,
      subject: `你关注的反馈「${payload.record.title}」状态变更为 ${payload.record.status}`,
      text: `状态已更新为：${payload.record.status}`,
    };
  }

  return null;
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, text: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    throw new Error(`Resend API error: HTTP ${response.status}`);
  }
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
