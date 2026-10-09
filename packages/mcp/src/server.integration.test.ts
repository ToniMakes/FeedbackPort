import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "./config";
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
    expect(tools.map((t) => t.name).sort()).toEqual(["get_feedback", "get_inbox_stats", "list_feedback", "list_products"]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
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

  it("cannot reach anything outside the views", async () => {
    await expect(db`select count(*) from public.feedback`).rejects.toMatchObject({ code: "42501" });
    await expect(db`select * from private.mcp_settings`).rejects.toMatchObject({ code: "42501" });
    await expect(db`update public.feedback set status = 'done'`).rejects.toMatchObject({ code: "42501" });
  });
});
