import postgres from "postgres";
import type { McpConfig } from "./config";

export type Db = postgres.Sql;

/**
 * Connect as the restricted `mcp_agent` role. `prepare: false` keeps this working through
 * Supabase's transaction-mode pooler, which does not support prepared statements.
 */
export function createDb(config: McpConfig): Db {
  return postgres(config.MCP_DATABASE_URL, {
    max: 2,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
}
