import type { Db } from "../db";
import { ToolError } from "../errors";
import { detectInjection } from "../safety/injection";
import { stripControlChars, truncate } from "../safety/untrusted";

export const MAX_SEARCH_LIMIT = 20;
const SNIPPET_RADIUS = 80;

/** Escape LIKE wildcards so a query is always matched literally */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function makeSnippet(text: string | null, query: string): string | null {
  if (!text) return null;
  const clean = stripControlChars(text).replace(/\s+/g, " ").trim();
  const at = clean.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return truncate(clean, SNIPPET_RADIUS * 2).text;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(clean.length, at + query.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

export interface SearchParams {
  query: string;
  product?: string;
  limit: number;
}

/**
 * Literal substring search over titles and bodies. Deliberately ILIKE rather than full-text or
 * embeddings: it works for Chinese text, needs no extension, and spends no money.
 */
export async function searchFeedback(db: Db, p: SearchParams) {
  const query = p.query.trim();
  if (query.length < 2) throw new ToolError("Search query must be at least 2 characters.");
  const pattern = `%${escapeLike(query)}%`;

  const rows = await db<
    {
      id: string;
      product_slug: string;
      title: string;
      body: string | null;
      status: string;
      vote_count: number;
      duplicate_of: string | null;
      created_at: Date;
    }[]
  >`
    select f.id, f.product_slug, f.title, f.body, f.status, f.vote_count, f.duplicate_of, f.created_at
    from mcp.feedback f
    where (f.title ilike ${pattern} or f.body ilike ${pattern})
      and f.duplicate_of is null
      ${p.product ? db`and f.product_slug = ${p.product}` : db``}
    order by f.vote_count desc, f.created_at desc, f.id desc
    limit ${p.limit}
  `;

  return {
    query,
    matches: rows.map((r) => {
      const injection = detectInjection(r.title, r.body);
      return {
        id: r.id,
        product: r.product_slug,
        status: r.status,
        votes: r.vote_count,
        created_at: r.created_at.toISOString(),
        injection_suspected: injection.suspected,
        untrusted: {
          title: truncate(stripControlChars(r.title), 200).text ?? "",
          snippet: makeSnippet(r.body, query),
        },
      };
    }),
  };
}
