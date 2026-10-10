/**
 * Spending guards for the evaluation harness. Every run calls a paid API, so nothing here is
 * optional: the harness refuses to start unless each check passes.
 */

/** USD per million tokens; prompts up to 100K tokens. Update when changing the default model. */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export const DEFAULT_MODEL = "claude-haiku-5-5";
export const DEFAULT_MAX_USD = 0.5;
export const MAX_TURNS_PER_CASE = 8;
export const MAX_TOKENS_PER_CALL = 1_500;

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function costOf(model: string, usage: Usage): number {
  const price = PRICES[model];
  if (!price) throw new Error(`No price table entry for model "${model}". Add it to PRICES before running.`);
  const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input * price.input + (usage.output_tokens ?? 0) * price.output) / 1_000_000;
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
  if (!env.ANTHROPIC_API_KEY) {
    return { allowed: false, dryRun: false, refusal: "ANTHROPIC_API_KEY is not set." };
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
