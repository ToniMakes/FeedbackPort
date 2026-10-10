import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { createDb } from "./db";
import { createServer } from "./server";

async function main() {
  const config = loadConfig();
  const db = createDb(config);
  const server = createServer(db, config);

  const shutdown = async () => {
    await db.end({ timeout: 2 }).catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(new StdioServerTransport());
  // stdout carries the protocol, so diagnostics go to stderr and never include secrets
  console.error("feedbackport-mcp ready (read-only inbox, drafts need human review)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "failed to start");
  process.exit(1);
});
