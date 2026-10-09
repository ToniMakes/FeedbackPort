import { z } from "zod";

const envSchema = z.object({
  /**
   * Connection string for the `mcp_agent` Postgres role (not the service-role key). That role can
   * only read the `mcp.*` views and insert drafts; see supabase/migrations/20261010000000_mcp_agent_views.sql.
   */
  MCP_DATABASE_URL: z
    .string()
    .min(1, "MCP_DATABASE_URL is required")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "MCP_DATABASE_URL must be a postgres:// URL"),
  /** Upper bound on the size of any single tool result, in characters */
  MCP_MAX_RESULT_CHARS: z.coerce.number().int().min(1_000).max(200_000).default(40_000),
  /** Base URL of the admin console, used to build review links in tool results */
  MCP_ADMIN_BASE_URL: z.string().url().optional(),
});

export type McpConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Report variable names and reasons only, never the values (the URL contains a password)
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  return parsed.data;
}
