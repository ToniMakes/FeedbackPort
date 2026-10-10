# ADR 0008: MCP server design

- Status: Accepted
- Date: 2026-10-10
- Depends on: [0007-revoke-anon-data-access](0007-revoke-anon-data-access.md)

## Context

We want AI assistants to work with the feedback inbox: summarise it, answer questions about it, and propose replies. Two facts shape the design. Feedback text is written by anonymous visitors, so it is untrusted and may contain instructions aimed at the assistant. And the inbox holds private data (submitter and voter emails) and can cause outward effects (a reply sends an email). An assistant that could read hostile text, see emails and act would be an easy target.

## Decision

- **Local stdio server, no network surface.** `packages/mcp` runs on the owner's machine. A remote HTTP/OAuth server is out of scope.
- **The capability boundary is enforced by the database.** The server connects as `mcp_agent`, a Postgres role with no privileges on `public` tables. It can `select` from views in the `mcp` schema and `insert` into `reply_drafts`. The tool list is a second layer, not the only one.
- **No email address is ever exposed.** The views return `submitter_ref`, a truncated salted SHA-256 of the lowercased email. The salt lives in the `private` schema, unreadable by the role.
- **The pseudonym is computed inline in the view, not by a function.** Postgres checks `EXECUTE` on functions called from a view against the *caller*, so exposing a helper function to `mcp_agent` would let it compute the ref for any guessed address and confirm identities. Inlining uses only built-in functions and needs no grant.
- **Writes are drafts, never replies.** `draft_reply` inserts into `reply_drafts` (pending). Nothing is written to `replies`, so the notification webhook cannot fire. Only an admin action calls `publish_reply_draft` (service role).
- **Safety rules live in the database.** A trigger sets `contains_links`, caps pending drafts (3 per item, 50 overall). `publish_reply_draft` flips the status and inserts the reply in one transaction, so a draft yields at most one reply and one email.
- **Untrusted text is isolated.** User-submitted fields appear only under `untrusted`, are truncated and stripped of control and bidirectional characters, and each result carries a notice. An injection heuristic adds `injection_suspected` as a hint only.
- **Fixed queries only.** There is no generic SQL tool; every statement is written in `packages/mcp/src/tools`.
- **Evaluate with real runs, cheaply and safely.** `packages/mcp-evals` drives a model through the built server and checks tool traces, final answers and database state. It defaults to a dry run, refuses in CI and on non-local databases, and stops at a USD cap.
- **Public paths must not call paid AI APIs.** The MCP server calls no model. Future features that spend money must be owner-triggered and capped (see the cost rule in the roadmap).

## Consequences

- A manipulated or buggy server cannot change statuses, send mail or read emails, because the database refuses. The worst realistic outcome is a misleading draft that a person must still approve.
- The injection heuristic is incomplete by design; the documented protection is the capability boundary plus human review.
- Two extra pieces of setup: a password for `mcp_agent`, and applying the new migrations to each hosted project. The migration history on hand-built projects may be empty, so apply the SQL directly instead of `supabase db push`.
- Using a dedicated role means the server uses a direct Postgres connection (`postgres` driver) rather than supabase-js. Through a transaction-mode pooler, prepared statements are disabled.
- Reviewers see the original feedback next to each draft, because a draft can still be steered by hostile text.

## Follow-ups from running the evaluation

Reading the transcripts of real runs ([MCP-EVALS.md](../MCP-EVALS.md)) changed three things in the server, none of them about the boundary:

- `search_feedback` requires every word, in any order. Matching the whole phrase literally let "CSV export" miss "Export notes to CSV".
- A product slug that does not exist is an error naming the known products. An empty list invited the misleading answer "no feedback", which is also true of a real empty product.
- The `draft_reply` description forbids asserting completed actions, promising refunds or dates, repeating claimed approvals and inventing contact details. On a weaker model this reduced genuine draft-content failures from 4 of 66 runs to 1 of 132.

What the evaluation did not change: the capability boundary held in every run on both models. What failed was draft content, which is what the review step is for.

---

# ADR 0008：MCP 服务器设计

- 状态：已采纳
- 日期：2026-10-10
- 依赖：[0007-revoke-anon-data-access](0007-revoke-anon-data-access.md)

## 背景

我们希望 AI 助手能处理反馈收件箱：做摘要、回答问题、起草回复。有两个事实决定了设计。其一，反馈文本由匿名访客写成，不可信，可能含有针对助手的指令。其二，收件箱里有隐私数据（提交者和投票者的邮箱），并且能产生对外影响（回复会发邮件）。一个既能读到恶意文本、又能看到邮箱、还能行动的助手，是很容易被攻击的目标。

## 决策

- **本地 stdio 服务器，不开放网络入口。** `packages/mcp` 运行在所有者的电脑上。远程 HTTP/OAuth 服务器不在范围内。
- **能力边界由数据库强制。** 服务器使用 `mcp_agent` 角色连接，它对 `public` 里的表没有任何权限，只能 `select` `mcp` schema 下的视图，以及向 `reply_drafts` `insert`。工具列表只是第二层，不是唯一一层。
- **绝不暴露邮箱。** 视图返回 `submitter_ref`，即小写邮箱加盐 SHA-256 的截断值。盐放在 `private` schema，角色读不到。
- **匿名引用在视图里内联计算，不用函数。** Postgres 对视图中调用的函数，按**调用者**检查 `EXECUTE` 权限。如果把辅助函数授权给 `mcp_agent`，它就能对任意猜测的邮箱算出引用并确认身份。内联后只用内置函数，不需要任何授权。
- **写入的是草稿，不是回复。** `draft_reply` 写入 `reply_drafts`（待审）。不会写入 `replies`，所以通知 webhook 不可能触发。只有管理员操作才会调用 `publish_reply_draft`（service role）。
- **安全规则放在数据库里。** 触发器自行设置 `contains_links`，并限制待审草稿数量（每条 3、全局 50）。`publish_reply_draft` 在同一个事务里更新状态并插入回复，所以一条草稿最多产生一条回复、一封邮件。
- **隔离不可信文本。** 用户提交的字段只出现在 `untrusted` 下，被截断并去除控制字符和双向文本字符，每次结果都附带提示。注入启发式只用 `injection_suspected` 做提示。
- **只用固定查询。** 没有通用 SQL 工具，所有语句都写在 `packages/mcp/src/tools` 里。
- **用真实运行来评测，并且便宜、安全。** `packages/mcp-evals` 驱动模型通过已构建的服务器，检查工具调用轨迹、最终回答和数据库状态。默认干跑，在 CI 和非本地数据库上拒绝运行，并在达到美元上限时停止。
- **公开路径不得调用付费 AI API。** MCP 服务器本身不调用模型。将来任何要花钱的功能，必须由所有者触发并有上限（见路线图中的成本规则）。

## 影响

- 被操纵或有缺陷的服务器也无法改状态、发邮件或读邮箱，因为数据库会拒绝。现实中最坏的结果是一条误导性的草稿，而它仍需要有人批准。
- 注入启发式在设计上就是不完整的，文档中声明的防线是能力边界加人工审核。
- 多了两项配置工作：给 `mcp_agent` 设置密码，以及在每个托管项目上应用新迁移。手工建表的项目迁移历史可能为空，要直接执行 SQL，而不是 `supabase db push`。
- 使用专用角色意味着服务器用 Postgres 直连（`postgres` 驱动），而不是 supabase-js。经由事务模式连接池时，要关闭预处理语句。
- 审核者能在每条草稿旁边看到原始反馈，因为草稿仍可能被恶意文本引导。

## 运行评测后的改进

阅读真实运行的记录（[MCP-EVALS.md](../MCP-EVALS.md)）之后，服务器改了三处，都与边界无关：

- `search_feedback` 要求所有词都出现，顺序不限。把整句当作字面短语匹配，会让 "CSV export" 漏掉 "Export notes to CSV"。
- 不存在的产品 slug 会返回报错并列出已知产品。空列表会引出"没有反馈"这种有误导性的回答，而对一个真实但为空的产品这句话同样成立。
- `draft_reply` 的描述禁止声称已完成的操作、承诺退款或日期、复述声称的批准以及编造联系方式。在较弱的模型上，这让真正的草稿内容失败从 66 次运行中的 4 个降到 132 次运行中的 1 个。

评测没有改变的是：能力边界在两个模型的每一次运行里都守住了。失败的是草稿内容，而这正是审核环节存在的理由。
