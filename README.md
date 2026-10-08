# FeedbackPort

**One developer. Multiple products. One place for feedback.**

FeedbackPort is an open-source feedback hub for indie developers and small teams building multiple products. Give each product its own public feedback board, collect ideas through a lightweight website widget, and manage conversations from one product-aware workspace.

Users can share ideas, vote for requests they care about, and follow progress. Developers can review feedback by product or across their entire portfolio, update statuses, and reply to users.

## What you can do

- **Collect feedback in context.** Embed a widget on a website, or link a desktop or mobile app directly to its public board.
- **Give each product a dedicated board.** Users can submit ideas, vote, filter by status, and read replies.
- **Manage several products together.** Work product by product, or use the cross-product inbox to see feedback in one place.
- **Close the loop.** Update a request’s status and reply from the admin console. Configured notification events email updates to the submitter.
- **Integrate without a frontend framework.** The widget uses vanilla TypeScript and Shadow DOM to keep its styles isolated from the host page.

## How it works

~~~mermaid
flowchart LR
    User[Your users] --> Board[Public product board]
    User --> Widget[Embeddable widget]
    Board --> API[Next.js app and API]
    Widget --> API
    Admin[You] --> Console[Product workspace and inbox]
    Console --> API
    API --> DB[(Supabase Postgres with RLS)]
    API --> Guard[Turnstile and Upstash rate limits]
    DB -->|database events| Edge[Supabase Edge Function]
    Edge --> Mail[Resend]
    Mail --> User
~~~

## Add the widget

After hosting the widget bundle and configuring your FeedbackPort instance, add this script to your product page. Replace the example URLs and key with your deployment’s values:

~~~html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-product="your-product"
  data-api-base="https://feedback.your-domain.com"
  data-turnstile-site-key="YOUR_TURNSTILE_SITE_KEY"
  async
></script>
~~~

A product without a website can link to its board directly:

~~~text
https://<product-slug>.board.<your-domain>
~~~

See the [integration guide](docs/INTEGRATION.md) for React, Next.js, Vue, and static-site examples, as well as products without a web page.

## Designed for multiple products

The app resolves a product tenant from its subdomain. Middleware extracts the product slug and passes it to the application; API routes resolve the corresponding product and apply its data scope. The widget communicates through the public API. Shared domain types and Zod schemas keep validation consistent between the web app and notification function.

Security and abuse prevention are layered:

- **Supabase Row Level Security (RLS)** enforces data-access rules in PostgreSQL.
- **Cloudflare Turnstile and a honeypot field** help screen automated submissions.
- **Upstash Redis rate limits** help curb repeated submissions and votes.
- **Server-side credentials** stay on the server and are never included in the browser bundle.

Email is event-driven: database changes trigger a Supabase Edge Function, which prepares and sends notifications through Resend. The API that records feedback does not need to send email directly.

## Technology

| Area | Technology |
|---|---|
| Language and workspace | TypeScript, pnpm workspaces |
| Web application | Next.js 15 App Router, React 19 |
| Shared domain layer | Zod schemas and shared TypeScript types |
| Embeddable widget | Vanilla TypeScript, Vite, Shadow DOM |
| Database and admin authentication | Supabase Postgres, Row Level Security, Supabase Auth |
| Abuse prevention | Cloudflare Turnstile, honeypot, Upstash Redis |
| Notifications | Supabase Database Webhooks, Deno Edge Functions, Resend |
| Current production hosting | Vercel |
| Container deployment | Multi-stage Docker, Node.js 22, non-root runtime; AWS ECS/Fargate staging environment |
| CI | GitHub Actions: lint, typecheck, tests, and web build |

## Project status

FeedbackPort is an actively developed open-source project. Production runs on Vercel with Supabase and supporting services, while an AWS ECS/Fargate staging environment is used for deployment verification. The repository contains the application, widget, and infrastructure code; deployment configuration depends on the environment. FeedbackPort is designed for self-hosting and is not a hosted SaaS sign-up service. Never put server-side credentials in client-side settings.

## Local development

~~~bash
pnpm install
pnpm dev
~~~

The web app runs locally at http://localhost:3000. Data-backed features require the services and environment variables listed in apps/web/.env.example, plus the Supabase migrations and notification function. See the [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [AWS staging](infra/terraform/README.md) documentation for implementation details.

## Documentation

| Document | Description |
|---|---|
| [Integration guide](docs/INTEGRATION.md) | Add the widget or link a product to its board |
| [Architecture](docs/ARCHITECTURE.md) | Tenant routing, service boundaries, notifications, and security |
| [Data model](docs/DATA_MODEL.md) | Database schema and Row Level Security policies |
| [API reference](docs/API.md) | Public and admin endpoints, widget configuration, notification events |
| [Roadmap](docs/ROADMAP.md) | Current scope and planned work |
| [Frontend changes](docs/FRONTEND_REDESIGN_PLAN.md) | Summary of the frontend updates |
| [Architecture decisions](docs/decisions) | Product and technology choices |
| [AWS staging guide](infra/terraform/README.md) | Terraform stacks, account setup, cost considerations, and deployment lifecycle |

## License

FeedbackPort is available under the [MIT License](LICENSE).

---

# FeedbackPort（中文）

**一个开发者，多个产品，一个反馈中心。**

FeedbackPort 是一款面向独立开发者和小团队的开源用户反馈工具。你可以为每个产品建立独立的公开反馈面板，通过轻量组件收集用户想法，再从一个产品工作区集中管理。

用户可以提交想法、为关注的需求投票并跟进处理状态；开发者可以按产品查看反馈，也可以打开跨产品收件箱统一处理、更新状态和回复用户。

## 你可以用它做什么

- **在用户所在的地方收集反馈。** 在网站嵌入组件；桌面或移动应用也可以直接链接到自己的公开面板。
- **每个产品拥有独立面板。** 用户可以提交想法、投票、按状态筛选并查看回复。
- **在一个工作区管理多个产品。** 可以逐个产品处理，也可以从跨产品收件箱集中查看。
- **回应并跟进用户。** 在管理后台更新状态、回复提交者；配置好的通知事件会通过邮件告知用户。
- **轻量接入不同技术栈。** Widget 使用原生 TypeScript 和 Shadow DOM 隔离样式，不依赖宿主页面的前端框架。

## 工作流程

~~~mermaid
flowchart LR
    User[产品用户] --> Board[公开反馈面板]
    User --> Widget[网页嵌入组件]
    Board --> API[Next.js 应用与 API]
    Widget --> API
    Admin[开发者] --> Console[产品工作区与收件箱]
    Console --> API
    API --> DB[(启用 RLS 的 Supabase Postgres)]
    API --> Guard[Turnstile 与 Upstash 限流]
    DB -->|数据库事件| Edge[Supabase Edge Function]
    Edge --> Mail[Resend]
    Mail --> User
~~~

## 接入嵌入组件

托管 widget 文件并配置好 FeedbackPort 实例后，在产品页面中加入脚本标签。请将示例网址和密钥换成你自己的部署配置：

~~~html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-product="your-product"
  data-api-base="https://feedback.your-domain.com"
  data-turnstile-site-key="YOUR_TURNSTILE_SITE_KEY"
  async
></script>
~~~

没有网页的产品可以直接链接到自己的反馈面板：

~~~text
https://<产品-slug>.board.<你的域名>
~~~

[接入指南](docs/INTEGRATION.md)包含 React、Next.js、Vue、静态网页示例，以及无网页产品的接入方式。

## 为多产品场景设计

应用根据产品子域名解析租户。中间件提取产品 slug 并传给应用；API 路由再解析对应产品并限定数据范围。Widget 通过公开 API 通信；共享领域类型和 Zod schema 让 Web 应用与通知函数使用一致的校验规则。

安全和防刷采用分层设计：

- **Supabase Row Level Security（RLS）** 在 PostgreSQL 数据层约束数据访问。
- **Cloudflare Turnstile 与蜜罐字段** 用于筛查自动化提交。
- **Upstash Redis 频率限制** 用于减少重复提交和投票。
- **服务端密钥只留在服务端**，不会写进浏览器 bundle。

邮件采用事件驱动方式：数据库变更触发 Supabase Edge Function，由它准备并通过 Resend 发送通知。记录反馈的 API 不需要直接承担邮件发送副作用。

## 技术栈

| 领域 | 技术 |
|---|---|
| 语言与工作区 | TypeScript、pnpm workspaces |
| Web 应用 | Next.js 15 App Router、React 19 |
| 共享领域层 | Zod schema、共享 TypeScript 类型 |
| 嵌入组件 | 原生 TypeScript、Vite、Shadow DOM |
| 数据库与管理员认证 | Supabase Postgres、Row Level Security、Supabase Auth |
| 防刷 | Cloudflare Turnstile、蜜罐、Upstash Redis |
| 通知 | Supabase Database Webhooks、Deno Edge Functions、Resend |
| 当前生产托管 | Vercel |
| 容器部署 | 多阶段 Docker、Node.js 22、非 root 运行；AWS ECS/Fargate staging 仍在建设 |
| 持续集成 | GitHub Actions：lint、类型检查、测试和 Web 构建 |

## 项目进度

FeedbackPort 是一个持续开发中的开源项目。当前生产部署运行在 Vercel，并使用 Supabase 及相关服务；AWS ECS/Fargate 部署也在推进中。仓库包含应用、widget 和基础设施代码，具体部署配置取决于运行环境。FeedbackPort 面向自部署场景，并非注册即用的托管 SaaS。请勿将服务端密钥放入前端配置。

## 本地开发

~~~bash
pnpm install
pnpm dev
~~~

Web 应用默认运行在 http://localhost:3000。数据功能需要按 apps/web/.env.example 配置服务，并应用 Supabase migrations、部署通知函数。实现细节见[架构文档](docs/ARCHITECTURE.md)、[API 文档](docs/API.md)和[AWS staging 文档](infra/terraform/README.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [接入指南](docs/INTEGRATION.md) | 嵌入 widget 或将产品链接到反馈面板 |
| [架构文档](docs/ARCHITECTURE.md) | 租户路由、模块边界、通知与安全设计 |
| [数据模型](docs/DATA_MODEL.md) | 数据库结构与 Row Level Security 策略 |
| [API 参考](docs/API.md) | 公开和管理端点、widget 配置、通知事件 |
| [迭代路线图](docs/ROADMAP.md) | 当前范围与后续计划 |
| [前端改造记录](docs/FRONTEND_REDESIGN_PLAN.md) | 前端界面与动效改动摘要 |
| [架构决策](docs/decisions) | 产品与技术方案记录 |
| [AWS staging 文档](infra/terraform/README.md) | Terraform 资源层次、账号设置、成本与部署生命周期 |

## 许可证

FeedbackPort 使用 [MIT License](LICENSE)。
