# Roadmap

## Phase 0: MVP (working for personal use)

- [x] `products` / `feedback` / `votes` / `replies` tables + RLS policies (see DATA_MODEL.md)
- [x] Admin console "new product" form (slug/name/brand_color) — `apps/web/src/app/admin/products/new`
- [x] Framework-agnostic embed widget (vanilla TS, Shadow DOM, honeypot field)
- [x] Public endpoints: submit feedback / vote / list / detail (`apps/web/src/app/api/feedback/**`) — the API layer is wired to real Supabase reads/writes
- [x] Public board UI: list/submit/vote at `/board`, detail + replies at `/board/[id]` (`apps/web/src/app/board/**`)
- [x] Admin console: cross-product unified inbox, single-product filter, status changes, writing replies (see the unified-inbox design in ARCHITECTURE.md), plus Supabase Auth magic-link login (`apps/web/src/app/admin/**`, `apps/web/src/app/login`)
- [x] Frontend visual refresh: flat, restrained design system across the public board, admin console, login, home page, and embed widget; includes reduced-motion support (`docs/FRONTEND_REDESIGN_PLAN.md`)
- [x] Three-layer anti-abuse: honeypot + Turnstile + Redis rate limiting (`apps/web/src/lib/{turnstile,rate-limit,request-ip}.ts`, already wired into the submit-feedback and vote endpoints)
- [x] Event-driven email notifications: `notify-submitter` queries Supabase and calls Resend for real (`supabase/functions/notify-submitter/index.ts`). Deployed and verified end-to-end against a real project — an admin reply now actually lands in the submitter's inbox. Two things this needed that don't ship as code, see the deployment note in API.md: the Database Webhook itself (table-specific, has to be created by hand per project) and turning off the function's "Verify JWT with legacy secret" toggle in favor of a shared-secret header (`WEBHOOK_SECRET` / `x-webhook-secret`), since the new-style `sb_secret_` keys aren't legacy-secret-signed JWTs
- [x] Real Turnstile token acquisition in both the widget (Shadow DOM, `packages/widget/src/turnstile.ts`) and the board (`apps/web/src/lib/turnstile-client.ts`) — the vote flow was reworked from `window.prompt` into an inline form (`apps/web/src/app/board/vote-button.tsx`) since Turnstile needs a persistent DOM container to render into. Requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `data-turnstile-site-key` — Cloudflare's public test key `1x00000000000000000000AA` works for local dev
- [x] First real deployment live at `feedback.tonimakes.com` (Vercel + Supabase in Singapore + Upstash + Cloudflare Turnstile + Resend, domain on Namecheap) — submit, vote, admin login, admin reply, and the reply notification email have all been verified against this real deployment with a test product
- [x] A second real product integrated: `aiqd` (AI Agent Quota Dashboard — an Electron desktop app with no web presence of its own). Registered via the admin console, public board live at `aiqd.board.tonimakes.com`. Since it's a desktop app rather than a web page, it doesn't use the embed widget — its Settings view links out to the public board instead (opened via the existing external-link window handler in its Electron main process), which is also the pattern documented in INTEGRATION.md's "no web page at all" case. Full loop verified end-to-end with a real test submission: real Cloudflare Turnstile challenge passed, row written to Supabase, shown on the board, admin reply sent from the console, and the reply notification email confirmed received

**Acceptance criteria**: this developer's own products can actually receive feedback, votes don't duplicate, users get emailed on status changes, and the unified inbox shows every product's new feedback at a glance. Met for two real products now, both with the full loop (submit → board → admin reply → notification email) verified end-to-end.

## Phase 1: open-source release prep

- [x] README with an architecture diagram and screenshots (`docs/images/`) captured from the seeded local instance, plus a short demo GIF
- [x] Deployment guide covering local, Docker (`docker-compose.yml`), and Vercel + Supabase (`docs/DEPLOYMENT.md`); a one-click deploy button is not provided
- [x] GitHub Actions CI (lint + typecheck + test)
- [x] Example tenant seed data: fictional `lumen` product (`supabase/seed.sql`, runs on `supabase db reset`)
- [x] MIT LICENSE file
- [x] A public sample board at `lumen.board.tonimakes.com`: a fictional `lumen` product on the production deployment, seeded from `supabase/seed.sql`. The scheduled reset (`.github/workflows/demo-reset.yml`) stays inert until a `DEMO_DATABASE_URL` secret is set, so until then visitor submissions are cleared by re-running the seed by hand

**Acceptance criteria**: a stranger clones the repo and, following the README, has a local instance running within 15 minutes.

## MCP server for AI assistants

- [x] Local MCP server (`packages/mcp`): seven tools, a counts resource and two prompts; reads through email-free views as a restricted database role; see [docs/MCP.md](MCP.md)
- [x] Human review loop: drafts land in `reply_drafts`, and only an admin publish writes a reply and sends the email (`/admin/drafts`)
- [x] Database permission tests (`npx supabase test db`, 47 assertions) and server tests (unit and integration)
- [x] Evaluation harness with spending guards and 22 cases, repeatable ([docs/MCP-EVALS.md](MCP-EVALS.md))
- [x] First recorded evaluation run: 12/17 under the first checks; all five failures were a judging bug (typographic apostrophes), fixed and re-judged to 17/17 with no server change
- [x] Harder injection cases, three repeats, and runs on a weaker model (`gpt-5-nano`): 4 genuine draft-content failures before the `draft_reply` description was tightened, 1 after (over 132 runs)
- [ ] Remote (HTTP with OAuth) transport; not started, and it would need its own threat model and a per-caller spending cap

## Phase 2: feature hardening

- [ ] Attachment/screenshot uploads (Supabase Storage), mainly for bug-report scenarios
- [ ] A changelog page: auto-summarizes feedback whose `status` moved to `done`

## Phase 3: AI-assisted triage (the differentiator)

**Cost rule:** no code path reachable by the public may call a paid AI API. Anything that spends money (embeddings, classification, digests) must run from an admin action, a scheduled job under the owner's control, or a local tool, and must have a hard spending cap and an off switch before it ships. The MCP server calls no model itself; the model runs in the user's own client. See [ADR 0008](decisions/0008-mcp-server-design.md).

- [ ] Enable the `embedding` column, wire up an embedding API (e.g. `text-embedding-3-small`); run the similarity pass as an owner-triggered batch job (never inline on a public submission) and flag possible duplicates for a human to confirm and merge (`duplicate_of`)
- [ ] Auto-tagging: bug / feature request / question, to help filter the admin console
- [ ] A weekly digest email: per-product summary of new feedback this week, top-voted items, and the pending count, sent to the developer

## Phase 4: optional deep integrations (low priority)

- [ ] For products that want a stronger identity story, an optional real SSO/OIDC integration (replacing the default email pre-fill approach)
- [ ] Webhooks/an open API for Slack, Linear, and similar third-party tools (something Fider/Astuto/Quackback already have — not this project's differentiator, so whether to invest here depends on community demand)

## Explicitly out of scope

- No paid/seat-based billing system — that's the shape of commercial SaaS, and conflicts with this project's positioning as "an indie developer's own tool that's also open source"
- Not chasing feature parity with Canny/Fider's full enterprise surface (complex permission tiers, SLAs) — staying "lightweight, good enough, easy to self-host" is the point

---

# 迭代路线图（中文）

## Phase 0：MVP（自用可跑通）

- [x] `products` / `feedback` / `votes` / `replies` 表 + RLS 策略（见 DATA_MODEL.md）
- [x] 管理后台"新增产品"表单（slug/name/brand_color）——`apps/web/src/app/admin/products/new`
- [x] 无框架嵌入组件（vanilla TS，Shadow DOM，蜜罐字段）
- [x] 公开端点：提交反馈 / 投票 / 列表 / 详情（`apps/web/src/app/api/feedback/**`），API 层已接 Supabase 真实读写
- [x] 公开面板 UI：`/board` 列表+提交+投票，`/board/[id]` 详情+回复（`apps/web/src/app/board/**`）
- [x] 管理后台：跨产品统一收件箱、单产品筛选、改状态、写回复（见 ARCHITECTURE.md 跨产品收件箱设计），含 Supabase Auth magic link 登录（`apps/web/src/app/admin/**`、`apps/web/src/app/login`）
- [x] 前端视觉改造：公开面板、管理后台、登录页、首页和嵌入组件统一为克制的平面风格，并支持减少动态效果（见 `docs/FRONTEND_REDESIGN_PLAN.md`）
- [x] 防刷三层：蜜罐 + Turnstile + Redis 频率限制（`apps/web/src/lib/{turnstile,rate-limit,request-ip}.ts`，已接进提交反馈/投票两个端点）
- [x] 事件驱动邮件通知：`notify-submitter` 真的查 Supabase、调 Resend 发信了（`supabase/functions/notify-submitter/index.ts`），已经在真实项目上端到端验证过——管理员写回复，提交者真的收到了邮件。有两件事代码里写不了，见 API.md 部署说明：Database Webhook 本身（跟具体表绑定，每个项目要手动建）、以及把函数的 "Verify JWT with legacy secret" 开关关掉、改用共享密钥校验（`WEBHOOK_SECRET` / `x-webhook-secret` 请求头）——因为新版 `sb_secret_` 密钥不是 legacy secret 签的 JWT，满足不了那个开关的校验
- [x] widget（Shadow DOM，`packages/widget/src/turnstile.ts`）和 board（`apps/web/src/lib/turnstile-client.ts`）都接了真实 Turnstile——投票流程也从 `window.prompt` 改成了内联表单（`apps/web/src/app/board/vote-button.tsx`），因为 Turnstile 需要一个常驻的 DOM 容器才能渲染。需要 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `data-turnstile-site-key`，本地开发可以用 Cloudflare 官方测试 key `1x00000000000000000000AA`
- [x] 第一次真实部署上线：`feedback.tonimakes.com`（Vercel + Supabase 新加坡 + Upstash + Cloudflare Turnstile + Resend，域名在 Namecheap）——提交、投票、管理员登录、管理员回复、回复通知邮件，全部拿一个测试产品在这套真实部署上验证过了
- [x] 第二个真实产品接入：`aiqd`（AI Agent Quota Dashboard——一个没有网页形态的 Electron 桌面应用）。已经在管理后台注册，公开面板 `aiqd.board.tonimakes.com` 已上线。因为是桌面应用而不是网页，没有用嵌入组件，而是在它的 Settings 页加了个链接跳到公开面板（通过它 Electron 主进程里已有的外部链接处理逻辑打开），这也是 INTEGRATION.md 里"完全没有网页"场景给的接入方式。完整链路真实验证过一遍：真实 Cloudflare Turnstile 挑战通过、写入 Supabase、面板上能看到、管理后台写了回复、回复通知邮件确认收到了

**验收标准**：自己的产品能实际收到反馈、投票不重复、状态变更用户能收到邮件、跨产品收件箱能一眼看完所有产品的新反馈。现在两个真实产品都达成了，完整链路（提交 → 面板 → 管理员回复 → 通知邮件）都端到端验证过。

## Phase 1：开源发布准备

- [x] README 含架构图和截图（`docs/images/`，取自种子数据的本地实例），另有简短演示 GIF
- [x] 部署指南，覆盖本地、Docker（`docker-compose.yml`）和 Vercel + Supabase（`docs/DEPLOYMENT.md`）；不提供一键部署按钮
- [x] GitHub Actions CI（lint + typecheck + test）
- [x] 示例租户种子数据：虚构的 `lumen` 产品（`supabase/seed.sql`，`supabase db reset` 时自动执行）
- [x] MIT LICENSE 文件
- [x] 公开示例面板：`lumen.board.tonimakes.com`，在生产部署上放一个虚构的 `lumen` 产品，数据来自 `supabase/seed.sql`。定时重置（`.github/workflows/demo-reset.yml`）在设置 `DEMO_DATABASE_URL` secret 之前不会执行，此前需要手动重新执行种子脚本来清理访客提交的内容

**验收标准**：陌生人 clone 仓库后，跟着 README 能在 15 分钟内跑起一个本地实例。

## 面向 AI 助手的 MCP 服务器

- [x] 本地 MCP 服务器（`packages/mcp`）：七个工具、一个计数资源、两个提示词模板；以受限的数据库角色，通过不含邮箱的视图读取，见 [docs/MCP.md](MCP.md)
- [x] 人工审核环：草稿进入 `reply_drafts`，只有管理员点击发布才会写入回复并发邮件（`/admin/drafts`）
- [x] 数据库权限测试（`npx supabase test db`，47 条断言）和服务器测试（单元与集成）
- [x] 带费用护栏、可重复运行的评测工具和 22 条用例（[docs/MCP-EVALS.md](MCP-EVALS.md)）
- [x] 第一次评测运行：第一版判定为 12/17；5 个失败全部是判定缺陷（排版撇号），修复并重新判定后为 17/17，服务器无需改动
- [x] 更难的注入用例、每例三次重复，以及在较弱模型（`gpt-5-nano`）上的运行：收紧 `draft_reply` 描述前有 4 个真正的草稿内容失败，之后在 132 次运行中为 1 个
- [ ] 远程（带 OAuth 的 HTTP）传输；尚未开始，需要单独的威胁模型和按调用者的花费上限

## Phase 2：功能增强

- [ ] 附件/截图上传（Supabase Storage），主要服务 bug 报告场景
- [ ] Changelog 页面：`status` 变为 `done` 的反馈自动汇总展示

## Phase 3：AI 辅助分诊（差异化亮点）

**成本规则：**任何公开可达的代码路径都不得调用付费 AI API。凡是要花钱的功能（embedding、分类、周报摘要），只能由管理员操作、所有者控制的定时任务或本地工具触发，并且在上线前必须有硬性的花费上限和关闭开关。MCP 服务器本身不调用任何模型，模型运行在用户自己的客户端里。见 [ADR 0008](decisions/0008-mcp-server-design.md)。

- [ ] 启用 `embedding` 字段，接入 embedding API（如 `text-embedding-3-small`），由所有者触发的批处理任务做相似度粗筛（不在公开提交请求里同步调用），提示可能的重复项供人工确认合并（`duplicate_of`）
- [ ] 自动打标签：bug / 功能请求 / 疑问，辅助管理后台筛选
- [ ] 每周摘要邮件：按产品汇总本周新增反馈数、热门投票项、待处理数量，发给开发者本人

## Phase 4：可选的深度集成（低优先级）

- [ ] 面向想要更强身份体系的产品，提供可选的真实 SSO/OIDC 接入（替代默认的邮箱预填方案）
- [ ] Webhook/开放 API，对接 Slack、Linear 等第三方工具（Fider/Astuto/Quackback 已有的能力，非本项目差异化重点，视社区需求决定是否投入）

## 明确不做的事

- 不做付费/席位计费体系——这是商业 SaaS 的形态，与本项目"独立开发者自用+开源"的定位冲突
- 不追求对齐 Canny/Fider 的全部企业功能（如复杂权限分级、SLA），保持"轻量、够用、易自部署"的定位
