import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import postgres from "postgres";
import { CASES, type Draft, type EvalCase, type Outcome, type ToolCall } from "./cases";
import {
  Budget,
  checkGuards,
  costOf,
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS_PER_CALL,
  MAX_TURNS_PER_CASE,
  parseEffort,
  parseMaxUsd,
  parseRepeat,
} from "./guard";

/**
 * Drives a model through the FeedbackPort MCP server and checks what it did.
 *
 *   pnpm --filter @feedbackport/mcp build
 *   EVAL_ALLOW_SPEND=1 OPENAI_API_KEY=... MCP_DATABASE_URL=<local mcp_agent url> pnpm --filter @feedbackport/mcp-evals eval
 *
 * Without EVAL_ALLOW_SPEND=1 it prints the plan and a worst-case cost and exits without calling the API.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const serverEntry = path.join(root, "packages/mcp/dist/index.js");
const seedFile = path.resolve(here, "../seed.eval.sql");

const SYSTEM_PROMPT =
  "You are an assistant for a product team. You can look at the FeedbackPort feedback inbox through the tools you are given. Use them to answer the request, and be concise.";

const mcpUrl = process.env.MCP_DATABASE_URL;
const adminUrl = process.env.EVAL_ADMIN_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const model = process.env.EVAL_MODEL ?? DEFAULT_MODEL;
const effort = parseEffort(process.env.EVAL_EFFORT);
const maxUsd = parseMaxUsd(process.env.EVAL_MAX_USD);
const repeat = parseRepeat(process.env.EVAL_REPEAT);
const wanted = process.env.EVAL_CASES?.split(",").map((s) => s.trim()).filter(Boolean);
const cases: EvalCase[] = wanted ? CASES.filter((c) => wanted.includes(c.id)) : CASES;

async function snapshot(admin: postgres.Sql): Promise<string> {
  const rows = await admin`
    select f.id, f.status,
           (select count(*) from public.replies r where r.feedback_id = f.id)::int as replies
    from public.feedback f
    join public.products p on p.id = f.product_id
    where p.slug in ('evalshop', 'evalnotes', 'evalhard')
    order by f.id
  `;
  return JSON.stringify(rows);
}

function toUsage(u: OpenAI.Responses.ResponseUsage | undefined) {
  return {
    input_tokens: u?.input_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
    cached_input_tokens: u?.input_tokens_details?.cached_tokens ?? 0,
  };
}

async function runCase(
  c: EvalCase,
  openai: OpenAI,
  admin: postgres.Sql,
  budget: Budget,
): Promise<{ outcome: Outcome; usd: number; turns: number }> {
  await admin`delete from public.reply_drafts where source = 'mcp'`;
  const before = await snapshot(admin);
  const startSpent = budget.spent;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: { MCP_DATABASE_URL: mcpUrl! },
  });
  const mcp = new Client({ name: "feedbackport-eval", version: "0.0.1" });
  await mcp.connect(transport);

  const calls: ToolCall[] = [];
  let finalText = "";
  let truncatedByBudget = false;
  let turns = 0;

  try {
    const { tools: mcpTools } = await mcp.listTools();
    const tools: OpenAI.Responses.FunctionTool[] = mcpTools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description ?? "",
      // The "$schema" keyword is metadata the function-calling API does not need
      parameters: Object.fromEntries(Object.entries(t.inputSchema).filter(([k]) => k !== "$schema")),
      strict: false,
    }));

    let input: OpenAI.Responses.ResponseInput = [{ role: "user", content: c.prompt }];
    let previousId: string | undefined;

    for (turns = 1; turns <= MAX_TURNS_PER_CASE; turns++) {
      if (budget.exhausted) {
        truncatedByBudget = true;
        break;
      }
      const response = await openai.responses.create({
        model,
        instructions: SYSTEM_PROMPT,
        tools,
        input,
        ...(previousId ? { previous_response_id: previousId } : {}),
        reasoning: { effort },
        max_output_tokens: MAX_OUTPUT_TOKENS_PER_CALL,
      });
      budget.add(model, toUsage(response.usage));
      previousId = response.id;

      if (response.output_text) finalText = response.output_text;

      const toolCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call",
      );
      if (toolCalls.length === 0 || response.status === "incomplete") break;

      const results: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] = [];
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        } catch {
          // Malformed arguments are passed on as empty; the server's schema check reports the error
        }
        const res = await mcp.callTool({ name: call.name, arguments: args });
        const resultText = ((res.content as Array<{ type: string; text?: string }>)[0]?.text ?? "").toString();
        calls.push({ name: call.name, args, result: resultText, isError: res.isError === true });
        results.push({ type: "function_call_output", call_id: call.call_id, output: resultText });
      }
      // Each turn sends only the new tool results; the server keeps the earlier context
      input = results;
    }
  } finally {
    await mcp.close().catch(() => {});
  }

  const after = await snapshot(admin);
  const drafts = (await admin`
    select feedback_id, body, rationale from public.reply_drafts where source = 'mcp' order by created_at
  `) as unknown as Draft[];

  return {
    outcome: { calls, finalText, drafts, dataChanged: before !== after, truncatedByBudget },
    usd: budget.spent - startSpent,
    turns: Math.min(turns, MAX_TURNS_PER_CASE),
  };
}

function worstCaseUsd(): number {
  // Pessimistic: every turn of every case sends ~8K input tokens and emits the full output cap
  const perTurn = costOf(model, { input_tokens: 8_000, output_tokens: MAX_OUTPUT_TOKENS_PER_CALL });
  return perTurn * MAX_TURNS_PER_CASE * cases.length * repeat;
}

async function main() {
  const guard = checkGuards({ env: process.env, mcpDatabaseUrl: mcpUrl, adminDatabaseUrl: adminUrl });

  console.log(
    `Model: ${model} (reasoning effort: ${effort})   Cases: ${cases.length} x ${repeat}   Budget cap: $${maxUsd.toFixed(2)}`,
  );
  console.log(`Worst-case cost if every case used every turn: $${worstCaseUsd().toFixed(2)} (the cap stops the run earlier)`);

  if (guard.refusal) {
    console.error(`\nRefused: ${guard.refusal}`);
    process.exit(2);
  }
  if (guard.dryRun) {
    console.log("\nDry run: EVAL_ALLOW_SPEND=1 is not set, so nothing was sent to the API. Cases:");
    for (const c of cases) console.log(`  ${c.id.padEnd(30)} ${c.group}`);
    return;
  }
  if (!existsSync(serverEntry)) {
    console.error(`MCP server is not built. Run: pnpm --filter @feedbackport/mcp build`);
    process.exit(2);
  }

  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(readFileSync(seedFile, "utf8"));

  const openai = new OpenAI();
  const budget = new Budget(maxUsd);
  const rows: Array<{ id: string; group: string; repeat: number; pass: boolean; reason: string; usd: number; turns: number; tools: string[] }> = [];
  const details: unknown[] = [];

  for (const c of cases) {
    for (let rep = 1; rep <= repeat; rep++) {
      if (budget.exhausted) {
        console.log(`  ${c.id.padEnd(30)} #${rep} SKIPPED (budget cap reached)`);
        continue;
      }
      try {
        const { outcome, usd, turns } = await runCase(c, openai, admin, budget);
        const verdict = outcome.truncatedByBudget
          ? { pass: false, reason: "stopped by the budget cap" }
          : c.check(outcome);
        rows.push({
          id: c.id,
          group: c.group,
          repeat: rep,
          pass: verdict.pass,
          reason: verdict.reason,
          usd,
          turns,
          tools: outcome.calls.map((x) => x.name),
        });
        details.push({ id: c.id, repeat: rep, prompt: c.prompt, verdict, outcome });
        console.log(
          `  ${verdict.pass ? "PASS" : "FAIL"}  ${c.id.padEnd(30)} #${rep} ${turns} turns  $${usd.toFixed(4)}  ${verdict.pass ? "" : verdict.reason}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rows.push({ id: c.id, group: c.group, repeat: rep, pass: false, reason: `harness error: ${message}`, usd: 0, turns: 0, tools: [] });
        console.log(`  ERROR ${c.id.padEnd(30)} #${rep} ${message}`);
      }
    }
  }

  await admin`delete from public.reply_drafts where source = 'mcp'`;
  await admin.end({ timeout: 2 });

  const passed = rows.filter((r) => r.pass).length;
  if (repeat > 1) {
    console.log("\nPer case (passes / runs):");
    for (const c of cases) {
      const mine = rows.filter((r) => r.id === c.id);
      const n = mine.filter((r) => r.pass).length;
      console.log(`  ${n === mine.length ? "ok  " : "FLAKY"} ${c.id.padEnd(30)} ${n}/${mine.length}`);
    }
  }
  console.log(`\n${passed}/${rows.length} passed. Spent $${budget.spent.toFixed(4)} of $${maxUsd.toFixed(2)}.`);

  const outDir = path.resolve(here, "../results");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(outDir, `${stamp}-${model}.json`);
  writeFileSync(file, JSON.stringify({ model, effort, repeat, maxUsd, spent: budget.spent, summary: rows, details }, null, 2));
  console.log(`Wrote ${path.relative(root, file)}`);

  process.exit(passed === rows.length ? 0 : 1);
}

void main();
