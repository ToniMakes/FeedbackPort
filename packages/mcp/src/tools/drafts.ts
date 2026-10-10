import type { Db } from "../db";
import { ToolError } from "../errors";

export interface DraftReplyParams {
  feedbackId: string;
  body: string;
  rationale?: string;
}

/**
 * Creates a pending draft. It is never a reply: nothing is sent and the feedback is unchanged
 * until an admin publishes it in the console. Link detection and queue limits are enforced by a
 * database trigger, so they hold even if this code is bypassed.
 */
export async function createDraft(db: Db, p: DraftReplyParams) {
  try {
    const rows = await db<{ id: string; contains_links: boolean; created_at: Date }[]>`
      insert into public.reply_drafts (feedback_id, body, rationale)
      values (${p.feedbackId}::uuid, ${p.body}, ${p.rationale ?? null})
      returning id, contains_links, created_at
    `;
    const row = rows[0]!;
    return {
      draft_id: row.id,
      status: "pending",
      contains_links: row.contains_links,
      created_at: row.created_at.toISOString(),
      message:
        "Draft saved for human review. It has NOT been sent and the feedback status is unchanged. An admin must publish it in the admin console before the user sees it.",
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23503") throw new ToolError(`No feedback item with id ${p.feedbackId}.`);
    if (code === "P0001") throw new ToolError((err as Error).message);
    throw err;
  }
}

export interface ListDraftsParams {
  status: "pending" | "published" | "rejected";
  limit: number;
  feedbackId?: string;
}

export async function listDrafts(db: Db, p: ListDraftsParams) {
  const rows = await db<
    {
      id: string;
      feedback_id: string;
      body: string;
      rationale: string | null;
      contains_links: boolean;
      status: string;
      created_at: Date;
    }[]
  >`
    select d.id, d.feedback_id, d.body, d.rationale, d.contains_links, d.status, d.created_at
    from public.reply_drafts d
    where d.status = ${p.status}
      ${p.feedbackId ? db`and d.feedback_id = ${p.feedbackId}::uuid` : db``}
    order by d.created_at desc
    limit ${p.limit}
  `;
  return {
    drafts: rows.map((d) => ({
      id: d.id,
      feedback_id: d.feedback_id,
      status: d.status,
      contains_links: d.contains_links,
      created_at: d.created_at.toISOString(),
      // Drafts are the agent's own earlier output, but may have been shaped by untrusted text
      untrusted: { body: d.body, rationale: d.rationale },
    })),
  };
}
