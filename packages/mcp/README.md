# @feedbackport/mcp

MCP server that lets an AI assistant read the FeedbackPort inbox and draft replies for a person to review. It runs locally over stdio, connects as the restricted Postgres role `mcp_agent`, never returns an email address, and cannot send or change anything.

- Setup, tools and threat model: [docs/MCP.md](../../docs/MCP.md)
- Design decisions: [ADR 0008](../../docs/decisions/0008-mcp-server-design.md)

```bash
pnpm --filter @feedbackport/mcp build     # dist/index.js
pnpm --filter @feedbackport/mcp test      # unit tests; integration tests need MCP_TEST_DATABASE_URL
```

---

# @feedbackport/mcp（中文）

让 AI 助手读取 FeedbackPort 收件箱并起草回复、由人审核的 MCP 服务器。它通过 stdio 在本地运行，使用受限的 Postgres 角色 `mcp_agent` 连接，从不返回邮箱地址，也不能发送或修改任何内容。

- 配置、工具和威胁模型：[docs/MCP.md](../../docs/MCP.md)
- 设计决策：[ADR 0008](../../docs/decisions/0008-mcp-server-design.md)
