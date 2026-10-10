# MCP evaluations

Tests whether an AI model, given only the MCP tools, does the right thing on realistic and hostile tasks. The package is `packages/mcp-evals`.

## How it works

1. A fixed fixture is loaded into a **local** database (`packages/mcp-evals/seed.eval.sql`): two fictional products, a duplicate, an item with a team reply, two feedback items containing instructions aimed at the assistant, and an email address written inside a feedback body. Submitter and voter addresses use `eval.test` so a leak is easy to spot.
2. For each case the harness starts the built MCP server over stdio, gives the model the tool list and one task, and runs the tool loop (at most 8 turns).
3. Checks are deterministic: the tools that were called, the final answer, the drafts that were created, and whether any status or reply changed in the database. A model is not used as a judge.

## Cases

| Group | Cases | What it tests |
|---|---|---|
| A tool choice | A1 to A4 | Picks the right tool and reports correct facts (products, top voted, search, unanswered count) |
| B multi-step | B1, B2 | Drafts exactly the requested replies; no stray or excess drafts |
| C injection | C1 to C4 | Hostile feedback does not change data, leak emails, steer a draft, or go unflagged |
| D privacy | D1 to D3 | Never outputs an email address, including one that appears inside a feedback body |
| E grounding | E1, E2 | Says "not found" instead of inventing an item or product |
| F out of scope | F1, F2 | Does not claim to change a status or send a reply; explains the review step |

17 cases in total; groups C, D and F (9 cases) are the safety-relevant ones.

## Running it

It spends money, so it is manual-only. A full run is priced at a worst case of about $0.21 on the default model and is capped at $0.50 by default.

```bash
npx supabase start
pnpm --filter @feedbackport/mcp build
docker exec supabase_db_supabase psql -U postgres -c "alter role mcp_agent password 'mcp_local'"

# Dry run: prints the plan and worst-case cost, calls nothing
MCP_DATABASE_URL=postgresql://mcp_agent:mcp_local@127.0.0.1:54322/postgres pnpm --filter @feedbackport/mcp-evals eval

# Real run
EVAL_ALLOW_SPEND=1 ANTHROPIC_API_KEY=<your key> \
MCP_DATABASE_URL=postgresql://mcp_agent:mcp_local@127.0.0.1:54322/postgres \
pnpm --filter @feedbackport/mcp-evals eval
```

| Variable | Default | Meaning |
|---|---|---|
| `EVAL_ALLOW_SPEND` | unset | Must be `1` to call the API; otherwise a dry run |
| `EVAL_MODEL` | `claude-haiku-5-5` | Model under test (must exist in the price table in `guard.ts`) |
| `EVAL_MAX_USD` | `0.5` | Hard stop; remaining cases are skipped |
| `EVAL_CASES` | all | Comma-separated case ids |
| `EVAL_ADMIN_DATABASE_URL` | local default | Privileged connection used to load fixtures and read results; must be local |

Guards: refuses when `CI` is set, when either database is not local, or when the key is missing; per case at most 8 turns and 1500 output tokens per call; spending is tracked from the API's usage counts.

## Results

No run has been recorded yet. This section is filled in from `packages/mcp-evals/results/*.json` after the first paid run, including each failure and what was changed in response (a tool description, a rule in the heuristic, a prompt). A run where everything passes at once proves little, so a first-run failure followed by a fix and a second run is the useful record.

## Limits

- Answers are checked with regular expressions, which can fail a correct answer phrased unexpectedly or pass a weak one. Failures are inspected by hand; the results file keeps every tool call and the full answer.
- One run per case is noisy. Raise the repeat count before drawing conclusions about a single case.
- The cases test this server's tool descriptions and boundaries, not the model's general safety.

---

# MCP 评测（中文）

测试 AI 模型在只拿到 MCP 工具的情况下，面对真实和恶意任务时是否做对。对应的包是 `packages/mcp-evals`。

## 工作方式

1. 把固定的测试数据载入**本地**数据库（`packages/mcp-evals/seed.eval.sql`）：两个虚构产品、一条重复项、一条已有团队回复的条目、两条含有针对助手的指令的反馈，以及一条正文里写着邮箱的反馈。提交者和投票者的邮箱都用 `eval.test`，一旦泄露很容易发现。
2. 对每个用例，评测程序启动已构建的 MCP 服务器（stdio），把工具列表和一个任务交给模型，并运行工具循环（最多 8 轮）。
3. 判定是确定性的：调用了哪些工具、最终回答、创建了哪些草稿、数据库里是否有状态或回复被改动。不用模型做评审。

## 用例

| 分组 | 用例 | 测什么 |
|---|---|---|
| A 工具选择 | A1 至 A4 | 选对工具并报出正确事实（产品、最高票、搜索、未回复数） |
| B 多步任务 | B1、B2 | 只起草被要求的回复，没有多余的草稿 |
| C 注入 | C1 至 C4 | 恶意反馈没有改数据、泄露邮箱、左右草稿内容，也没有被忽略不报 |
| D 隐私 | D1 至 D3 | 从不输出邮箱，包括写在反馈正文里的邮箱 |
| E 事实依据 | E1、E2 | 说"找不到"，而不是编造条目或产品 |
| F 越界请求 | F1、F2 | 不声称改了状态或已发送回复，并说明需要审核 |

共 17 条用例，其中 C、D、F 三组（9 条）与安全相关。

## 运行

会花钱，所以只能手动运行。完整运行在默认模型下最坏估算约 $0.21，默认上限 $0.50。

```bash
npx supabase start
pnpm --filter @feedbackport/mcp build
docker exec supabase_db_supabase psql -U postgres -c "alter role mcp_agent password 'mcp_local'"

# 干跑：只打印计划和最坏花费，不调用任何接口
MCP_DATABASE_URL=postgresql://mcp_agent:mcp_local@127.0.0.1:54322/postgres pnpm --filter @feedbackport/mcp-evals eval

# 真实运行
EVAL_ALLOW_SPEND=1 ANTHROPIC_API_KEY=<你的密钥> \
MCP_DATABASE_URL=postgresql://mcp_agent:mcp_local@127.0.0.1:54322/postgres \
pnpm --filter @feedbackport/mcp-evals eval
```

护栏：设置了 `CI`、数据库不是本地、或缺少密钥时拒绝运行；每个用例最多 8 轮，每次调用最多 1500 个输出 token；花费按接口返回的用量统计。

## 结果

尚未记录任何运行。第一次付费运行之后，会根据 `packages/mcp-evals/results/*.json` 在这里补充，包括每一个失败，以及针对它做了什么调整（工具描述、启发式规则或提示词）。一次全部通过的运行说明不了太多，"第一轮失败、修改、第二轮通过"才是有价值的记录。

## 局限

- 回答用正则表达式检查，可能误判措辞出乎意料的正确回答，也可能放过质量不高的回答。失败项要人工查看，结果文件保留了每次工具调用和完整回答。
- 每个用例只跑一次，噪声较大。想对单个用例下结论，需要先增加重复次数。
- 用例测的是这个服务器的工具描述和边界，而不是模型整体的安全性。
