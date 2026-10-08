# Deployment Guide

Three ways to run FeedbackPort, from quickest to most production-like. They all depend on the same four external services; the local path only needs Docker.

| Service | Used for | Local development |
|---|---|---|
| Supabase | Postgres, admin login, notification Edge Function | Local stack via the Supabase CLI (Docker) |
| Cloudflare Turnstile | Bot protection on submit and vote | Always-pass test keys |
| Upstash Redis | Rate limiting | Optional (skipped outside production) |
| Resend | Notification emails | Optional (the function skips sending without a key) |

## 1. Local instance (about 15 minutes)

Requires Node 22.13+, Docker, and pnpm (`corepack enable`).

```bash
pnpm install
npx supabase start
```

`supabase start` applies every migration in `supabase/migrations/` and then `supabase/seed.sql`, which creates a fictional product with the slug `demo` and a handful of ideas in every status. When it finishes it prints the API URL and the keys. Use the legacy `ANON_KEY` and `SERVICE_ROLE_KEY` values (run `npx supabase status -o env` to print them again); the app's Supabase clients expect those JWT-style keys.

Create `apps/web/.env.local` from `apps/web/.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
DEFAULT_TENANT_SLUG=demo
```

The two Turnstile values are Cloudflare's published always-pass test keys. Leave the Upstash variables empty: outside production the rate limiter is skipped.

```bash
pnpm dev
```

- Public board: <http://localhost:3000/board>
- Admin console: <http://localhost:3000/login>. There is no sign-up. Create your admin user in Supabase Studio (<http://127.0.0.1:54323>, Authentication, Add user), request a magic link on the login page, and read the email in the local mail catcher at <http://127.0.0.1:54324>.
- Widget: run `pnpm widget:publish` to build it into `apps/web/public/widget.js`, then follow the [integration guide](INTEGRATION.md) with `data-api-base="http://localhost:3000"` and `data-product="demo"`.

Reset the demo data at any time with `npx supabase db reset`.

## 2. Docker (any host that runs containers)

The repo ships a multi-stage `Dockerfile` and a `docker-compose.yml`. Supabase, Upstash, Turnstile and Resend stay hosted; the container runs only the Next.js app.

```bash
cp .env.docker.example .env      # fill in your hosted project values
docker compose up --build
```

`NEXT_PUBLIC_*` values are compiled into the browser bundle at build time, so an image is bound to one environment. Server secrets are supplied at runtime through `env_file` and are never written to an image layer. The container serves the app on port 3000 and a liveness endpoint at `GET /api/health`. See [ADR 0003](decisions/0003-container-image.md) for the reasoning and the [AWS staging guide](../infra/terraform/README.md) for a worked ECS/Fargate deployment.

Supabase must be reachable at the same URL from the browser and from the container, so point `NEXT_PUBLIC_SUPABASE_URL` at a hosted project rather than the local CLI stack.

## 3. Vercel and hosted Supabase (what production runs)

1. **Supabase project.** Create one, link it with `npx supabase link --project-ref <ref>`, and run `npx supabase db push` to apply the migrations.
2. **Admin user.** In Authentication, create the single admin user. Magic-link sign-in refuses to create new users, so only this account can log in.
3. **Turnstile.** Create a widget in Cloudflare. Add every domain that embeds the widget to its allowed hostnames, otherwise verification fails.
4. **Upstash.** Create a Redis database and copy the REST URL and token.
5. **Vercel.** Import the repo, set the root directory to `apps/web`, and add the environment variables from `apps/web/.env.example`. Point a wildcard domain such as `*.board.your-domain.com` at the project so `<slug>.board.your-domain.com` resolves to the right product.
6. **Notifications (optional).** Deploy `supabase/functions/notify-submitter`, set its `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` and `WEBHOOK_SECRET` secrets, turn off the legacy JWT check, and install the webhooks with `infra/Configure-SupabaseDatabaseWebhooks.ps1`. The full list of one-time steps is in [API.md](API.md#event-driven-notification-contract).
7. **Widget.** Run `pnpm widget:publish` and serve `apps/web/public/widget.js` from the app itself or any CDN.
8. **First product.** Sign in at `/login`, add a product in the admin console, and follow the [integration guide](INTEGRATION.md).

## Public demo

The simplest public demo needs no extra infrastructure: add a fictional `demo` product to a deployment you already run, and visitors open `https://demo.board.your-domain.com/board`. The wildcard board domain from the production setup already routes it.

1. Run `supabase/seed.sql` against that project once (paste it into the Supabase SQL editor, or `psql "$DATABASE_URL" -f supabase/seed.sql`). It only touches the product with slug `demo`, and it suspends the reply triggers while it runs, so the notification webhook never emails the sample addresses.
2. To reset visitor submissions automatically, add the project's Postgres connection string as the `DEMO_DATABASE_URL` repository secret. `.github/workflows/demo-reset.yml` then re-runs the seed every day.

If you would rather keep demo traffic away from real data, deploy a second copy with its own Supabase project and `DEFAULT_TENANT_SLUG=demo`, then point `DEMO_DATABASE_URL` at that project instead.

---

# 部署指南

三种运行方式，从最快到最接近生产。它们依赖同样四个外部服务；本地方式只需要 Docker。

| 服务 | 用途 | 本地开发 |
|---|---|---|
| Supabase | Postgres、管理员登录、通知 Edge Function | 用 Supabase CLI（Docker）起本地栈 |
| Cloudflare Turnstile | 提交和投票的机器人防护 | 使用永远通过的测试 key |
| Upstash Redis | 频率限制 | 可选（非生产环境自动跳过） |
| Resend | 通知邮件 | 可选（没配 key 时函数跳过发信） |

## 1. 本地实例（约 15 分钟）

需要 Node 22.13+、Docker 和 pnpm（`corepack enable`）。

```bash
pnpm install
npx supabase start
```

`supabase start` 会应用 `supabase/migrations/` 下所有迁移，再执行 `supabase/seed.sql`：它会创建一个 slug 为 `demo` 的虚构产品，以及每种状态各有的若干想法。完成后会打印 API 地址和各种密钥。请使用旧式的 `ANON_KEY` 和 `SERVICE_ROLE_KEY`（可用 `npx supabase status -o env` 重新打印）。

按 `apps/web/.env.example` 创建 `apps/web/.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase start 输出的 anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase start 输出的 service_role key>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
DEFAULT_TENANT_SLUG=demo
```

两个 Turnstile 值是 Cloudflare 公布的永远通过的测试 key。Upstash 变量留空即可：非生产环境会跳过频率限制。

```bash
pnpm dev
```

- 公开面板：<http://localhost:3000/board>
- 管理后台：<http://localhost:3000/login>。没有注册入口，请先在 Supabase Studio（<http://127.0.0.1:54323>，Authentication，Add user）创建管理员，在登录页请求 magic link，再到本地邮件收件箱 <http://127.0.0.1:54324> 查看邮件。
- 嵌入组件：运行 `pnpm widget:publish` 把它构建到 `apps/web/public/widget.js`，再按[接入指南](INTEGRATION.md)接入，设置 `data-api-base="http://localhost:3000"` 和 `data-product="demo"`。

随时可用 `npx supabase db reset` 重置演示数据。

## 2. Docker（任何能跑容器的主机）

仓库自带多阶段 `Dockerfile` 和 `docker-compose.yml`。Supabase、Upstash、Turnstile 和 Resend 仍使用托管服务，容器只运行 Next.js 应用。

```bash
cp .env.docker.example .env      # 填入你的托管项目配置
docker compose up --build
```

`NEXT_PUBLIC_*` 在构建时编入浏览器代码，所以一个镜像只对应一个环境。服务端密钥通过 `env_file` 在运行时注入，不会写入任何镜像层。容器在 3000 端口提供应用，并提供存活检查 `GET /api/health`。设计理由见 [ADR 0003](decisions/0003-container-image.md)，完整的 ECS/Fargate 部署示例见 [AWS staging 指南](../infra/terraform/README.md)。

Supabase 必须能从浏览器和容器用同一个地址访问，所以 `NEXT_PUBLIC_SUPABASE_URL` 请指向托管项目，而不是本地 CLI 栈。

## 3. Vercel + 托管 Supabase（当前生产环境的做法）

1. **Supabase 项目**：新建项目，用 `npx supabase link --project-ref <ref>` 关联，再运行 `npx supabase db push` 应用迁移。
2. **管理员账号**：在 Authentication 里创建唯一的管理员。magic link 登录不会自动创建用户，所以只有这个账号能登录。
3. **Turnstile**：在 Cloudflare 创建 widget，并把所有嵌入组件的域名加入允许的主机名，否则校验会失败。
4. **Upstash**：创建 Redis 数据库，复制 REST URL 和 token。
5. **Vercel**：导入仓库，根目录设为 `apps/web`，按 `apps/web/.env.example` 添加环境变量。把 `*.board.你的域名.com` 这样的泛域名指向项目，`<slug>.board.你的域名.com` 才能解析到对应产品。
6. **通知（可选）**：部署 `supabase/functions/notify-submitter`，配置 `RESEND_API_KEY`、`NOTIFY_FROM_EMAIL`、`WEBHOOK_SECRET`，关闭 legacy JWT 校验，并用 `infra/Configure-SupabaseDatabaseWebhooks.ps1` 安装 webhook。完整的一次性步骤见 [API.md](API.md#event-driven-notification-contract)。
7. **Widget**：运行 `pnpm widget:publish`，把 `apps/web/public/widget.js` 放在应用自身或任意 CDN 上。
8. **第一个产品**：在 `/login` 登录，于管理后台添加产品，再按[接入指南](INTEGRATION.md)接入。

## 公开 Demo

最简单的公开 Demo 不需要额外基础设施：在你已有的部署里加一个虚构的 `demo` 产品，访客打开 `https://demo.board.你的域名.com/board` 即可，生产环境配置好的泛域名会直接路由过去。

1. 对该项目执行一次 `supabase/seed.sql`（粘贴到 Supabase SQL 编辑器，或 `psql "$DATABASE_URL" -f supabase/seed.sql`）。它只会改动 slug 为 `demo` 的产品，并在执行期间暂停回复上的触发器，所以通知 webhook 不会给示例地址发邮件。
2. 想自动清理访客提交的内容，就把该项目的 Postgres 连接串存为仓库 secret `DEMO_DATABASE_URL`，`.github/workflows/demo-reset.yml` 会每天重新执行种子脚本。

如果想让 Demo 流量远离真实数据，可以另外部署一份，配独立的 Supabase 项目和 `DEFAULT_TENANT_SLUG=demo`，再让 `DEMO_DATABASE_URL` 指向那个项目。
