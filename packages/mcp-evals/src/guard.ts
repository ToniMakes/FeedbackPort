/**
 * Spending guards for the evaluation harness. Every run calls a paid API, so nothing here is
 * optional: the harness refuses to start unless each check passes.
 */

/** USD per million tokens, standard tier, from OpenAI's published pricing. Update with the model. */
export const PRICES: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, output: 0.5 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
};

/**
 * Cheapest current-generation small model that supports tool calling. The older gpt-5-nano has a
 * lower list price but is a reasoning model whose hidden reasoning tokens are billed as output,
 * so per-task cost is not guaranteed to be lower.
 */
export const DEFAULT_MODEL = "gpt-6-luna";
export const DEFAULT_EFFORT = "low";
export const DEFAULT_MAX_USD = 0.5;
export const MAX_TURNS_PER_CASE = 8;
/** Includes reasoning tokens, so it is larger than the visible answer needs */
export const MAX_OUTPUT_TOKENS_PER_CALL = 3_000;

export interface Usage {
  /** Total input tokens, cached ones included */
  input_tokens: number;
  /** Total output tokens, reasoning tokens included */
  output_tokens: number;
  /** Of the input tokens, how many were served from cache */
  cached_input_tokens?: number | null;
}

export function costOf(model: string, usage: Usage): number {
  const price = PRICES[model];
  if (!price) throw new Error(`No price table entry for model "${model}". Add it to PRICES before running.`);
  const cached = Math.min(usage.cached_input_tokens ?? 0, usage.input_tokens ?? 0);
  const fresh = (usage.input_tokens ?? 0) - cached;
  return (fresh * price.input + cached * price.cachedInput + (usage.output_tokens ?? 0) * price.output) / 1_000_000;
}

export class Budget {
  spent = 0;
  constructor(readonly maxUsd: number) {}

  add(model: string, usage: Usage): void {
    this.spent += costOf(model, usage);
  }

  get exhausted(): boolean {
    return this.spent >= this.maxUsd;
  }
}

export interface GuardInput {
  env: NodeJS.ProcessEnv;
  mcpDatabaseUrl: string | undefined;
  adminDatabaseUrl: string;
}

export interface GuardResult {
  allowed: boolean;
  /** Why a real run was refused. Set whenever `allowed` is false and the cause is a hard stop. */
  refusal?: string;
  /** True when the user did not opt in: print the plan and exit without calling the API */
  dryRun: boolean;
}

const LOCAL = /@(127\.0\.0\.1|localhost|\[::1\])[:/]/;

export function checkGuards({ env, mcpDatabaseUrl, adminDatabaseUrl }: GuardInput): GuardResult {
  if (env.CI) {
    return { allowed: false, dryRun: false, refusal: "Refusing to run in CI: evaluations spend money and are manual-only." };
  }
  if (!mcpDatabaseUrl || !LOCAL.test(mcpDatabaseUrl)) {
    return {
      allowed: false,
      dryRun: false,
      refusal: "MCP_DATABASE_URL must point at a LOCAL database (127.0.0.1 or localhost). Evaluations write fixtures.",
    };
  }
  if (!LOCAL.test(adminDatabaseUrl)) {
    return { allowed: false, dryRun: false, refusal: "EVAL_ADMIN_DATABASE_URL must be a LOCAL database." };
  }
  if (env.EVAL_ALLOW_SPEND !== "1") {
    return { allowed: false, dryRun: true };
  }
  if (!env.OPENAI_API_KEY) {
    return { allowed: false, dryRun: false, refusal: "OPENAI_API_KEY is not set." };
  }
  return { allowed: true, dryRun: false };
}

export function parseMaxUsd(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_MAX_USD;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 25) {
    throw new Error("EVAL_MAX_USD must be a number greater than 0 and at most 25.");
  }
  return n;
}

export const MAX_REPEAT = 5;

export function parseRepeat(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_REPEAT) {
    throw new Error(`EVAL_REPEAT must be a whole number from 1 to ${MAX_REPEAT}.`);
  }
  return n;
}

const EFFORTS = ["none", "low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

export function parseEffort(raw: string | undefined): Effort {
  if (raw === undefined || raw === "") return DEFAULT_EFFORT;
  if ((EFFORTS as readonly string[]).includes(raw)) return raw as Effort;
  throw new Error(`EVAL_EFFORT must be one of: ${EFFORTS.join(", ")}.`);
}
