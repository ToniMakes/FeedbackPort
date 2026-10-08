// Deno Edge Function, triggered by a Supabase Database Webhook; never called directly by business code.
// Contract: see "Event-driven notification contract" in docs/API.md; design rationale: "The key decoupling point" in docs/ARCHITECTURE.md.
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
  // The Supabase "Verify JWT" toggle is off (it checks JWTs signed by Supabase itself, which the newer
  // sb_secret_ key system doesn't necessarily satisfy), so we check a shared secret ourselves.
  // Without this, anyone who knows the URL could forge a webhook payload
  // and use your Resend account as a spam relay to email arbitrary addresses.
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
    // A missing Resend key shouldn't make the whole webhook error out; just record the skip.
    // Self-hosters who don't want email yet keep the rest of the system working
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
      subject: `New reply to your feedback "${feedback.title}"`,
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
      subject: `Status of feedback you follow "${payload.record.title}" changed to ${payload.record.status}`,
      text: `The status was updated to: ${payload.record.status}`,
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
