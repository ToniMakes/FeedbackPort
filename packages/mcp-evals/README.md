# @feedbackport/mcp-evals

Drives a model through the MCP server and checks what it did. **It spends money**, so it is a dry run unless `EVAL_ALLOW_SPEND=1`, it refuses in CI and on non-local databases, and it stops at a USD cap (default $0.50). A full run of the 22 cases x 3 costs a few cents on the default model.

- How it works, cases, how to run, and every recorded result: [docs/MCP-EVALS.md](../../docs/MCP-EVALS.md)
- `pnpm --filter @feedbackport/mcp-evals rejudge` re-applies the current checks to a saved run for free.

---

# @feedbackport/mcp-evals（中文）

驱动模型通过 MCP 服务器完成任务，并检查它做了什么。**它会花钱**，所以除非设置 `EVAL_ALLOW_SPEND=1`，否则只做干跑；在 CI 和非本地数据库上会拒绝运行；达到美元上限（默认 $0.50）就停止。默认模型下，22 条用例 x 3 的完整运行只需几美分。

- 工作方式、用例、运行方法和全部已记录的结果：[docs/MCP-EVALS.md](../../docs/MCP-EVALS.md)
- `pnpm --filter @feedbackport/mcp-evals rejudge` 可以免费地对保存的运行重新应用当前的判定。
