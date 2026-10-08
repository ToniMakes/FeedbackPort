# FeedbackPort

**One developer. Multiple products. One place for feedback.**

FeedbackPort is an open-source feedback hub for indie developers and small teams. Give each product a public board, collect ideas through an embeddable widget, and manage feedback from one workspace. Users can share ideas, vote, and follow status updates; developers can review feedback and reply across products.

## What you can do

- Give every product its own public feedback board.
- Collect ideas from a website with a small, framework-free widget.
- Review and reply to feedback by product or across your portfolio.
- Show users the current status of each idea on the public board.

## Add the widget

After deploying FeedbackPort and building the widget bundle, add this script to your product page. Replace the example URLs and key with your deployment values. `data-api-base` is optional when the widget and API share an origin; set it when they are hosted separately.

~~~html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-api-base="https://feedback.your-domain.com"
  data-product="your-product"
  data-turnstile-site-key="YOUR_TURNSTILE_SITE_KEY"
  async
></script>
~~~

The widget follows the visitor’s browser language (English or Simplified Chinese). Set `data-lang="en"` or `data-lang="zh"` to choose a language explicitly. A product without a website can link directly to its board:

~~~text
https://<product-slug>.board.<your-domain>
~~~

See the [integration guide](docs/INTEGRATION.md) for React, Next.js, Vue, static-site, and board-link examples.

## Self-hosting

FeedbackPort is designed to run on your infrastructure; it is not a hosted SaaS sign-up service. Production currently runs on Vercel, and an AWS ECS/Fargate staging environment is used for deployment verification. Your deployment needs Supabase for the database and admin authentication, Cloudflare Turnstile and Upstash Redis for abuse prevention, and optional Resend configuration for email notifications.

Never put server-side credentials in client-side settings. See the [architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), [API reference](docs/API.md), and [AWS staging guide](infra/terraform/README.md) for implementation and deployment details.

## Local development

~~~bash
pnpm install
pnpm dev
~~~

The web app runs at <http://localhost:3000>. Data-backed features require the environment variables in `apps/web/.env.example`, the Supabase migrations, and the notification function. See the [integration guide](docs/INTEGRATION.md) before embedding the widget.

## Technology

| Area | Technology |
|---|---|
| Language and workspace | TypeScript, pnpm workspaces |
| Web application | Next.js 15 App Router, React 19 |
| Shared domain layer | Zod schemas and TypeScript types |
| Embeddable widget | Vanilla TypeScript, Vite, Shadow DOM |
| Database and admin authentication | Supabase Postgres, Row Level Security, Supabase Auth |
| Abuse prevention | Cloudflare Turnstile, honeypot, Upstash Redis |
| Notifications | Supabase Database Webhooks, Deno Edge Functions, Resend |
| Production hosting | Vercel |
| Staging deployment | Docker, AWS ECS/Fargate |

## Documentation

| Document | Description |
|---|---|
| [Integration guide](docs/INTEGRATION.md) | Add the widget or link a product to its board |
| [Architecture](docs/ARCHITECTURE.md) | Tenant routing, service boundaries, notifications, and security |
| [Data model](docs/DATA_MODEL.md) | Database schema and Row Level Security policies |
| [API reference](docs/API.md) | Public and admin endpoints, widget configuration, and notification events |
| [Roadmap](docs/ROADMAP.md) | Current scope and planned work |
| [Frontend updates](docs/FRONTEND_REDESIGN_PLAN.md) | Summary of frontend updates |
| [Architecture decisions](docs/decisions) | Product and technology decisions |
| [AWS staging guide](infra/terraform/README.md) | Infrastructure, setup, costs, and deployment lifecycle |

## License

FeedbackPort is available under the [MIT License](LICENSE).

---

# FeedbackPort（中文）

**一个开发者，多个产品，一个反馈中心。**

FeedbackPort 是面向独立开发者和小团队的开源反馈工具。为每个产品提供公开面板，通过嵌入组件收集想法，并在一个工作区集中管理。用户可以分享想法、参与投票、查看处理状态；开发者可以按产品或跨产品跟进并回复。

## 可以用它做什么

- 为每个产品建立独立的公开反馈面板。
- 通过轻量组件从网站收集想法，不依赖宿主页面的前端框架。
- 按产品或跨产品查看反馈、更新状态并回复用户。
- 在公开面板展示每条想法的当前状态。

## 接入嵌入组件

部署 FeedbackPort 并构建 widget 后，将下面的脚本加入产品页面。请将示例网址和密钥换成自己的部署配置。Widget 与 API 同源时可以省略 `data-api-base`；分开托管时请显式设置。

~~~html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-api-base="https://feedback.your-domain.com"
  data-product="your-product"
  data-turnstile-site-key="YOUR_TURNSTILE_SITE_KEY"
  async
></script>
~~~

组件默认跟随访问者的浏览器语言（英文或简体中文）；也可以用 `data-lang="en"` 或 `data-lang="zh"` 指定语言。没有网站的产品可以直接链接到反馈面板：

~~~text
https://<产品-slug>.board.<你的域名>
~~~

[接入指南](docs/INTEGRATION.md)包含 React、Next.js、Vue、静态网页接入以及直接链接面板的示例。

## 自行部署

FeedbackPort 面向自部署场景，并非注册即用的托管 SaaS。当前生产环境运行在 Vercel，AWS ECS/Fargate staging 环境用于验证部署。运行需要 Supabase 数据库和管理员认证、Cloudflare Turnstile 与 Upstash Redis 防刷；邮件通知还需要配置 Resend。

请勿将服务端密钥放入前端配置。实现和部署细节见[架构文档](docs/ARCHITECTURE.md)、[数据模型](docs/DATA_MODEL.md)、[API 参考](docs/API.md)和[AWS staging 指南](infra/terraform/README.md)。

## 本地开发

~~~bash
pnpm install
pnpm dev
~~~

Web 应用默认运行在 <http://localhost:3000>。数据功能需要按 `apps/web/.env.example` 配置环境变量、应用 Supabase migrations 并部署通知函数。嵌入 widget 前请先查看[接入指南](docs/INTEGRATION.md)。

## 技术栈

| 领域 | 技术 |
|---|---|
| 语言与工作区 | TypeScript、pnpm workspaces |
| Web 应用 | Next.js 15 App Router、React 19 |
| 共享领域层 | Zod schema、TypeScript 类型 |
| 嵌入组件 | 原生 TypeScript、Vite、Shadow DOM |
| 数据库与管理员认证 | Supabase Postgres、Row Level Security、Supabase Auth |
| 防刷 | Cloudflare Turnstile、蜜罐、Upstash Redis |
| 通知 | Supabase Database Webhooks、Deno Edge Functions、Resend |
| 生产托管 | Vercel |
| Staging 部署 | Docker、AWS ECS/Fargate |

## 文档

| 文档 | 内容 |
|---|---|
| [接入指南](docs/INTEGRATION.md) | 嵌入 widget 或将产品链接到反馈面板 |
| [架构文档](docs/ARCHITECTURE.md) | 租户路由、模块边界、通知与安全设计 |
| [数据模型](docs/DATA_MODEL.md) | 数据库结构与 Row Level Security 策略 |
| [API 参考](docs/API.md) | 公开和管理端点、widget 配置与通知事件 |
| [迭代路线图](docs/ROADMAP.md) | 当前范围与计划中的工作 |
| [前端更新记录](docs/FRONTEND_REDESIGN_PLAN.md) | 前端更新摘要 |
| [架构决策](docs/decisions) | 产品与技术决策 |
| [AWS staging 指南](infra/terraform/README.md) | 基础设施、环境配置、成本与部署生命周期 |

## 许可证

FeedbackPort 使用 [MIT License](LICENSE)。
