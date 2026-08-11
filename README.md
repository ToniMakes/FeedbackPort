# FeedbackPort

A user feedback management system for **indie developers**: one person, many products, one unified inbox.

Unlike Canny / Fider / Astuto / Quackback — which are built around "one organization serving many customers" — FeedbackPort assumes a different scenario: "one developer with several unrelated products who needs a single place to see and manage everything." Key features:

- **Unified inbox across products**: the admin console aggregates feedback from every product by default, no logging in/switching per product
- **Zero standing servers**: fully serverless (Supabase + Vercel + Resend + Cloudflare Turnstile), free tiers cover early-stage volume
- **Independent public board per product**: subdomain-based, each with its own branding — users vote, track progress, and get emailed when a maintainer replies
- **Framework-agnostic embed widget**: a single `<script>` tag works on any product page regardless of tech stack
- MIT licensed — self-host it, fork it, send PRs

Tech choices and the decision process live in [docs/decisions](docs/decisions); why not just use Canny/Fider/Astuto/Quackback is covered in [0001](docs/decisions/0001-self-build-vs-saas-vs-oss.md).

## Integrate your product

Add one line before `</body>` — works on any tech stack, no build step required:

```html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-product="your-product-slug"
  data-turnstile-site-key="1x00000000000000000000AA"
  async
></script>
```

No web page at all (a desktop/mobile app)? Every registered product also gets a public voting board for free at `https://<slug>.board.your-domain.com` — just link to it from a "Feedback" menu item or settings screen.

Full guide — React/Next.js and Vue snippets, WordPress, pre-filling the logged-in user's email, a troubleshooting checklist, and a ready-to-copy AI-assistant prompt: **[docs/INTEGRATION.md](docs/INTEGRATION.md)**

## Docs index

| Doc | Contents |
|---|---|
| [docs/decisions/0001](docs/decisions/0001-self-build-vs-saas-vs-oss.md) | Self-build vs SaaS vs open-source comparison and decision |
| [docs/decisions/0002](docs/decisions/0002-tech-stack.md) | Tech stack and monorepo package layout |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module boundaries, multi-tenant routing, event-driven notifications, security boundaries |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | ER diagram, table DDL, RLS policies |
| [docs/API.md](docs/API.md) | Public endpoints, admin endpoints, widget init params, notification event contract |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Playbook for wiring FeedbackPort into a specific product (framework snippets + troubleshooting + an AI-assistant prompt template) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | MVP scope, open-source release prep, later phases |

## Project structure

```
├── apps/web/            # Next.js: public board + admin console + API Routes
├── packages/core/        # shared types, zod validation schemas, business-rule constants
├── packages/widget/      # framework-agnostic embed widget
├── supabase/
│   ├── migrations/       # database migrations
│   └── functions/        # Edge Functions (notifications, etc.)
└── docs/
```

## Local development

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm dev   # start apps/web
```

## Current status

Phase 0 is live and verified end-to-end against a real deployment (`feedback.tonimakes.com`: Vercel + Supabase + Upstash + Cloudflare Turnstile + Resend). Submitting feedback, voting, admin magic-link login, admin replies, and the reply notification email have all been confirmed working with a real test product. What's left: integrating a second real product. See the Phase 0 checklist in [docs/ROADMAP.md](docs/ROADMAP.md) for the full picture.

## License

MIT

---

# FeedbackPort（中文）

面向**独立开发者**的用户反馈管理系统：一个人、多个产品、一个统一收件箱。

不同于 Canny / Fider / Astuto / Quackback 这类"一个组织服务多个客户"的反馈平台，FeedbackPort 假设的场景是"一个开发者名下有好几个不相关的产品，需要一个地方统一看、统一管"。核心特点：

- **跨产品统一收件箱**：管理后台默认聚合所有产品的反馈，无需逐个登录/切换
- **零常驻服务器**：纯 serverless（Supabase + Vercel + Resend + Cloudflare Turnstile），免费额度下可支撑早期体量
- **每产品独立公开面板**：按子域名区分，各自品牌，用户投票、看进度、被回复后收邮件通知
- **无框架嵌入组件**：一个 `<script>` 标签即可接入任意技术栈的产品页面
- MIT 协议，欢迎自部署、fork、提 PR

技术选型和决策过程见 [docs/decisions](docs/decisions)，为什么不直接用现成的 Canny/Fider/Astuto/Quackback 见 [0001](docs/decisions/0001-self-build-vs-saas-vs-oss.md)。

## 接入你的产品

在 `</body>` 前加一行——任意技术栈都能用，不需要额外构建步骤：

```html
<script
  src="https://cdn.你的域名.com/widget.js"
  data-product="你的产品slug"
  data-turnstile-site-key="1x00000000000000000000AA"
  async
></script>
```

产品完全没有网页（比如桌面/移动端 App）？每个注册过的产品都自带一个免费的公开投票面板，地址是 `https://<slug>.board.你的域名.com`——直接在 App 的"意见反馈"菜单项或设置页里链过去就行。

完整接入指南——React/Next.js 和 Vue 代码片段、WordPress、已登录用户邮箱预填、排查清单、可直接复制的 AI 辅助接入提示词：**[docs/INTEGRATION.md](docs/INTEGRATION.md)**

## 文档索引

| 文档 | 内容 |
|---|---|
| [docs/decisions/0001](docs/decisions/0001-self-build-vs-saas-vs-oss.md) | 自建 vs SaaS vs 开源方案对比与决策 |
| [docs/decisions/0002](docs/decisions/0002-tech-stack.md) | 技术选型与 monorepo 包结构 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 模块边界、多租户路由、事件驱动通知设计、安全边界 |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | ER 图、表结构 DDL、RLS 策略 |
| [docs/API.md](docs/API.md) | 公开端点、管理端点、Widget 接入参数、通知事件契约 |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | 把 FeedbackPort 接进具体产品的操作手册（各框架代码片段 + 排查清单 + AI 辅助接入提示词） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | MVP 范围、开源发布准备、后续阶段规划 |

## 项目结构

```
├── apps/web/           # Next.js：公开面板 + 管理后台 + API Routes
├── packages/core/       # 共享类型、zod 校验 schema、业务规则常量
├── packages/widget/     # 无框架嵌入组件
├── supabase/
│   ├── migrations/      # 数据库迁移
│   └── functions/       # 通知服务等 Edge Functions
└── docs/
```

## 本地开发

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm dev   # 启动 apps/web
```

## 当前状态

Phase 0 已经真实上线并端到端验证过了（`feedback.tonimakes.com`：Vercel + Supabase + Upstash + Cloudflare Turnstile + Resend）。提交反馈、投票、管理员 magic link 登录、管理员回复、回复通知邮件，都拿一个真实测试产品在这套真实部署上确认跑通了。剩下的：再接入第二个真实产品。完整进度见 [docs/ROADMAP.md](docs/ROADMAP.md) 的 Phase 0 checklist。

## License

MIT
