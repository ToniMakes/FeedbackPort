import { FEEDBACK_STATUSES } from "@feedbackport/core";
import type { Db } from "../db";
import { ToolError } from "../errors";
import { wrapUntrusted } from "../safety/untrusted";

/**
 * Fixed, parameterised queries. There is deliberately no generic "run SQL" entry point: every
 * statement the agent can cause is written here and reviewed as code.
 */

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

type Status = (typeof FEEDBACK_STATUSES)[number];

export interface ListFeedbackParams {
  product?: string;
  status?: Status;
  sort: "newest" | "votes";
  limit: number;
  cursor?: string;
  includeDuplicates: boolean;
  unansweredOnly: boolean;
}

interface FeedbackRow {
  id: string;
  product_slug: string;
  title: string;
  body: string | null;
  status: string;
  vote_count: number;
  admin_reply_count: number;
  submitter_ref: string;
  duplicate_of: string | null;
  created_at: Date;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id })).toString("base64url");
}

export function decodeCursor(cursor: string): { t: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { t?: unknown; id?: unknown };
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      typeof parsed.t !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.t)) ||
      !uuid.test(parsed.id)
    ) {
      throw new Error("bad shape");
    }
    return { t: parsed.t, id: parsed.id };
  } catch {
    throw new ToolError("Invalid cursor. Pass the next_cursor value from the previous call unchanged.");
  }
}

function feedbackSummary(row: FeedbackRow) {
  return {
    id: row.id,
    product: row.product_slug,
    status: row.status,
    votes: row.vote_count,
    has_admin_reply: row.admin_reply_count > 0,
    is_duplicate: row.duplicate_of !== null,
    submitter_ref: row.submitter_ref,
    created_at: row.created_at.toISOString(),
    ...wrapUntrusted(row.title, row.body, { includeBody: false }),
  };
}

/**
 * Fail loudly on a product slug that does not exist. Without this an unknown slug quietly yields
 * an empty list, which reads as "that product has no feedback" and misleads the caller. The
 * message lists the real slugs (admin-defined, not user text) so the caller can correct itself.
 */
export async function assertProductExists(db: Db, slug: string | undefined): Promise<void> {
  if (!slug) return;
  const rows = await db<{ slug: string }[]>`select slug from mcp.products order by slug`;
  if (rows.some((r) => r.slug === slug)) return;
  const known = rows.map((r) => r.slug).join(", ") || "(none)";
  throw new ToolError(`Unknown product "${slug}". Known products: ${known}.`);
}

export async function listProducts(db: Db) {
  const rows = await db<
    { slug: string; name: string; total: number; open: number; planned: number; in_progress: number; done: number; declined: number; unanswered: number }[]
  >`
    select
      p.slug,
      p.name,
      count(f.id)::int as total,
      (count(f.id) filter (where f.status = 'open'))::int as open,
      (count(f.id) filter (where f.status = 'planned'))::int as planned,
      (count(f.id) filter (where f.status = 'in_progress'))::int as in_progress,
      (count(f.id) filter (where f.status = 'done'))::int as done,
      (count(f.id) filter (where f.status = 'declined'))::int as declined,
      (count(f.id) filter (where f.admin_reply_count = 0 and f.status = 'open'))::int as unanswered
    from mcp.products p
    left join mcp.feedback f on f.product_id = p.id and f.duplicate_of is null
    group by p.slug, p.name
    order by p.slug
  `;
  return {
    products: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      total: r.total,
      by_status: { open: r.open, planned: r.planned, in_progress: r.in_progress, done: r.done, declined: r.declined },
      open_without_reply: r.unanswered,
    })),
  };
}

export async function listFeedback(db: Db, p: ListFeedbackParams) {
  if (p.cursor && p.sort !== "newest") {
    throw new ToolError("cursor is only supported with sort=newest. Use a smaller limit or filter by status instead.");
  }
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  const fetchCount = p.limit + 1;
  await assertProductExists(db, p.product);

  const rows = await db<FeedbackRow[]>`
    select f.id, f.product_slug, f.title, f.body, f.status, f.vote_count, f.admin_reply_count,
           f.submitter_ref, f.duplicate_of, f.created_at
    from mcp.feedback f
    where true
      ${p.product ? db`and f.product_slug = ${p.product}` : db``}
      ${p.status ? db`and f.status = ${p.status}` : db``}
      ${p.includeDuplicates ? db`` : db`and f.duplicate_of is null`}
      ${p.unansweredOnly ? db`and f.admin_reply_count = 0` : db``}
      ${cursor ? db`and (f.created_at, f.id) < (${cursor.t}::timestamptz, ${cursor.id}::uuid)` : db``}
    order by ${p.sort === "votes" ? db`f.vote_count desc, f.created_at desc, f.id desc` : db`f.created_at desc, f.id desc`}
    limit ${fetchCount}
  `;

  const page = rows.slice(0, p.limit);
  const hasMore = rows.length > p.limit;
  const last = page[page.length - 1];
  return {
    items: page.map(feedbackSummary),
    next_cursor: hasMore && last && p.sort === "newest" ? encodeCursor(last.created_at, last.id) : null,
    ...(hasMore && p.sort === "votes" ? { note: "More results exist. Narrow with product/status, or ask for a smaller set." } : {}),
  };
}

export async function getFeedback(db: Db, id: string) {
  const rows = await db<FeedbackRow[]>`
    select f.id, f.product_slug, f.title, f.body, f.status, f.vote_count, f.admin_reply_count,
           f.submitter_ref, f.duplicate_of, f.created_at
    from mcp.feedback f
    where f.id = ${id}::uuid
  `;
  const row = rows[0];
  if (!row) return null;

  const replies = await db<{ id: string; body: string; is_admin: boolean; created_at: Date }[]>`
    select r.id, r.body, r.is_admin, r.created_at
    from mcp.replies r
    where r.feedback_id = ${id}::uuid
    order by r.created_at asc
    limit 50
  `;
  const pending = await db<{ count: number }[]>`
    select count(*)::int as count from public.reply_drafts where feedback_id = ${id}::uuid and status = 'pending'
  `;

  return {
    ...feedbackSummary(row),
    ...wrapUntrusted(row.title, row.body, { includeBody: true }),
    duplicate_of: row.duplicate_of,
    pending_drafts: pending[0]?.count ?? 0,
    replies: replies.map((r) => ({
      id: r.id,
      from: r.is_admin ? "team" : "user",
      created_at: r.created_at.toISOString(),
      untrusted: { body: r.body },
    })),
  };
}

export interface InboxStatsParams {
  product?: string;
  sinceDays: number;
  topN: number;
}

export async function getInboxStats(db: Db, p: InboxStatsParams) {
  await assertProductExists(db, p.product);
  const scope = p.product ? db`and f.product_slug = ${p.product}` : db``;

  const byStatus = await db<{ product: string; status: string; count: number }[]>`
    select f.product_slug as product, f.status, count(*)::int as count
    from mcp.feedback f
    where f.duplicate_of is null ${scope}
    group by f.product_slug, f.status
    order by f.product_slug, f.status
  `;
  const recent = await db<{ product: string; count: number }[]>`
    select f.product_slug as product, count(*)::int as count
    from mcp.feedback f
    where f.duplicate_of is null
      and f.created_at >= now() - make_interval(days => ${p.sinceDays}) ${scope}
    group by f.product_slug
    order by f.product_slug
  `;
  const unanswered = await db<{ product: string; count: number }[]>`
    select f.product_slug as product, count(*)::int as count
    from mcp.feedback f
    where f.duplicate_of is null and f.status = 'open' and f.admin_reply_count = 0 ${scope}
    group by f.product_slug
    order by f.product_slug
  `;
  const top = await db<FeedbackRow[]>`
    select f.id, f.product_slug, f.title, f.body, f.status, f.vote_count, f.admin_reply_count,
           f.submitter_ref, f.duplicate_of, f.created_at
    from mcp.feedback f
    where f.duplicate_of is null and f.status in ('open', 'planned', 'in_progress') ${scope}
    order by f.vote_count desc, f.created_at desc
    limit ${p.topN}
  `;

  return {
    window_days: p.sinceDays,
    by_product_and_status: byStatus,
    new_in_window: recent,
    open_without_reply: unanswered,
    top_voted_unfinished: top.map(feedbackSummary),
  };
}
