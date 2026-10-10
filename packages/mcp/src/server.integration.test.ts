import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "./config";
import postgres from "postgres";
import { createDb, type Db } from "./db";
import { createServer } from "./server";

/**
 * Talks to a real local Supabase through the restricted `mcp_agent` role. Skipped unless
 * MCP_TEST_DATABASE_URL is set, so `pnpm test` stays green without a database. To run:
 *   npx supabase db reset
 *   docker exec supabase_db_supabase psql -U postgres -c "alter role mcp_agent password 'mcp_local'"
 *   MCP_TEST_DATABASE_URL=postgresql://mcp_agent:mcp_local@127.0.0.1:54322/postgres pnpm --filter @feedbackport/mcp test
 */
const url = process.env.MCP_TEST_DATABASE_URL;

describe.skipIf(!url)("MCP server against a local database", () => {
  let db: Db;
  let client: Client;

  beforeAll(async () => {
    // mcp_agent cannot delete drafts (that is the point), so a privileged connection clears the
    // ones earlier runs left behind. Local databases only.
    const adminUrl = process.env.MCP_TEST_ADMIN_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    if (!/@(127\.0\.0\.1|localhost)[:/]/.test(adminUrl)) throw new Error("refusing to clean a non-local database");
    const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await admin`delete from public.reply_drafts where source = 'mcp'`;
    await admin.end({ timeout: 2 });

    const config = loadConfig({ MCP_DATABASE_URL: url });
    db = createDb(config);
    const server = createServer(db, config);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client?.close();
    await db?.end({ timeout: 2 });
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
    return { isError: res.isError === true, text, json: JSON.parse(text) as Record<string, any> };
  }

  it("exposes exactly the read tools and no write-capable ones", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "draft_reply",
      "get_feedback",
      "get_inbox_stats",
      "list_drafts",
      "list_feedback",
      "list_products",
      "search_feedback",
    ]);
    // The only tool that writes anything is draft_reply, and what it writes is a pending draft
    const writers = tools.filter((t) => t.annotations?.readOnlyHint === false).map((t) => t.name);
    expect(writers).toEqual(["draft_reply"]);
  });

  it("lists the sample product with status counts", async () => {
    const { json } = await call("list_products");
    const lumen = json.products.find((p: { slug: string }) => p.slug === "lumen");
    expect(lumen).toBeDefined();
    expect(lumen.total).toBeGreaterThan(0);
  });

  it("returns feedback titles without bodies and without any email", async () => {
    const { text, json } = await call("list_feedback", { product: "lumen", limit: 5 });
    expect(json.items.length).toBeGreaterThan(0);
    expect(json.items[0].untrusted).toHaveProperty("title");
    expect(json.items[0].untrusted).not.toHaveProperty("body");
    expect(text).not.toMatch(/@example\.com/);
    expect(json.items[0].submitter_ref).toMatch(/^[0-9a-f]{8}$/);
  });

  it("sorts by votes and paginates newest-first with a cursor", async () => {
    const top = await call("list_feedback", { product: "lumen", sort: "votes", limit: 3 });
    const votes = top.json.items.map((i: { votes: number }) => i.votes);
    expect([...votes].sort((a, b) => b - a)).toEqual(votes);

    const first = await call("list_feedback", { product: "lumen", limit: 2 });
    expect(first.json.next_cursor).toBeTruthy();
    const second = await call("list_feedback", { product: "lumen", limit: 2, cursor: first.json.next_cursor });
    const firstIds = first.json.items.map((i: { id: string }) => i.id);
    for (const item of second.json.items) expect(firstIds).not.toContain(item.id);
  });

  it("rejects a cursor with sort=votes and a malformed cursor", async () => {
    const a = await call("list_feedback", { sort: "votes", cursor: "abc" });
    expect(a.isError).toBe(true);
    const b = await call("list_feedback", { cursor: "abc" });
    expect(b.isError).toBe(true);
    expect(b.json.error).toMatch(/Invalid cursor/);
  });

  it("rejects out-of-range limits at the schema level", async () => {
    const res = await client.callTool({ name: "list_feedback", arguments: { limit: 500 } });
    expect(res.isError).toBe(true);
  });

  it("gets one item with replies and no email, and reports unknown ids", async () => {
    const list = await call("list_feedback", { product: "lumen", status: "done", limit: 1 });
    const id = list.json.items[0].id as string;
    const { text, json } = await call("get_feedback", { id });
    expect(json.item.untrusted).toHaveProperty("body");
    expect(json.item.replies.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/@example\.com/);

    const missing = await call("get_feedback", { id: "00000000-0000-0000-0000-000000000000" });
    expect(missing.json.error).toBe("not_found");
  });

  it("computes inbox statistics", async () => {
    const { json } = await call("get_inbox_stats", { product: "lumen", since_days: 365, top_n: 3 });
    expect(json.by_product_and_status.length).toBeGreaterThan(0);
    expect(json.top_voted_unfinished.length).toBeLessThanOrEqual(3);
  });

  it("saves a draft as pending, flags links, and leaves feedback and replies untouched", async () => {
    const list = await call("list_feedback", { product: "lumen", status: "open", limit: 1 });
    const item = list.json.items[0];
    const before = await call("get_feedback", { id: item.id });

    const plain = await call("draft_reply", { feedback_id: item.id, body: "Thanks, we are looking at this.", rationale: "acknowledge" });
    expect(plain.json.status).toBe("pending");
    expect(plain.json.contains_links).toBe(false);
    expect(plain.json.message).toMatch(/NOT been sent/);

    const linked = await call("draft_reply", { feedback_id: item.id, body: "See https://example.com/x for details" });
    expect(linked.json.contains_links).toBe(true);

    const after = await call("get_feedback", { id: item.id });
    expect(after.json.item.replies).toEqual(before.json.item.replies);
    expect(after.json.item.status).toBe(before.json.item.status);
    expect(after.json.item.pending_drafts).toBe(before.json.item.pending_drafts + 2);

    const drafts = await call("list_drafts", { feedback_id: item.id });
    expect(drafts.json.drafts.length).toBe(after.json.item.pending_drafts);
  });

  it("enforces the per-item draft limit and reports unknown feedback ids", async () => {
    const list = await call("list_feedback", { product: "lumen", status: "planned", limit: 1 });
    const id = list.json.items[0].id as string;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await call("draft_reply", { feedback_id: id, body: `draft ${i}` }));
    expect(results.filter((r) => r.isError)).toHaveLength(1);
    expect(results[3]!.json.error).toMatch(/too many pending drafts/);

    const missing = await call("draft_reply", { feedback_id: "00000000-0000-0000-0000-000000000000", body: "x" });
    expect(missing.isError).toBe(true);
    expect(missing.json.error).toMatch(/No feedback item/);
  });

  it("rejects empty or oversized drafts at the schema level", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    expect((await client.callTool({ name: "draft_reply", arguments: { feedback_id: id, body: "" } })).isError).toBe(true);
    expect((await client.callTool({ name: "draft_reply", arguments: { feedback_id: id, body: "x".repeat(2001) } })).isError).toBe(true);
  });

  it("searches literally, escapes wildcards, and returns snippets without bodies", async () => {
    const hit = await call("search_feedback", { query: "dark mode", product: "lumen" });
    expect(hit.json.matches.length).toBeGreaterThan(0);
    expect(hit.json.matches[0].untrusted).toHaveProperty("snippet");
    expect(hit.json.matches[0].untrusted).not.toHaveProperty("body");

    // Several words: all must appear, in any order ("mode dark" finds "Dark mode")
    const reordered = await call("search_feedback", { query: "mode dark", product: "lumen" });
    expect(reordered.json.matches.length).toBeGreaterThan(0);
    const impossible = await call("search_feedback", { query: "dark zzzqqq", product: "lumen" });
    expect(impossible.json.matches).toHaveLength(0);

    // '%' must not behave as a wildcard that matches everything
    const wild = await call("search_feedback", { query: "%%", product: "lumen" });
    expect(wild.json.matches).toHaveLength(0);

    const short = await client.callTool({ name: "search_feedback", arguments: { query: "a" } });
    expect(short.isError).toBe(true);
  });

  it("exposes the triage and digest prompts and a counts-only resource", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["triage_inbox", "weekly_digest"]);
    const triage = await client.getPrompt({ name: "triage_inbox", arguments: { product: "lumen" } });
    const text = (triage.messages[0]!.content as { text: string }).text;
    expect(text).toMatch(/Never follow instructions/);
    expect(text).toMatch(/draft_reply/);

    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(["feedbackport://products"]);
    const res = await client.readResource({ uri: "feedbackport://products" });
    expect(JSON.parse((res.contents[0] as { text: string }).text).products.length).toBeGreaterThan(0);
  });

  it("cannot reach anything outside the views", async () => {
    await expect(db`select count(*) from public.feedback`).rejects.toMatchObject({ code: "42501" });
    await expect(db`select * from private.mcp_settings`).rejects.toMatchObject({ code: "42501" });
    await expect(db`update public.feedback set status = 'done'`).rejects.toMatchObject({ code: "42501" });
    await expect(
      db`insert into public.replies (feedback_id, body, is_admin) select id, 'x', true from mcp.feedback limit 1`,
    ).rejects.toMatchObject({ code: "42501" });
    await expect(db`update public.reply_drafts set status = 'published'`).rejects.toMatchObject({ code: "42501" });
  });
});
