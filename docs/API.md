# API Design

## Two kinds of callers, two ways to identify the tenant

Public endpoints have two kinds of callers, and they resolve the tenant (`product_id`) differently — you can't use the same logic for both:

- **board (public page)**: runs on FeedbackPort's own subdomain (`<slug>.board.domain.com`), a same-origin request; middleware resolves the tenant from the subdomain and injects `x-tenant`, which the client cannot forge or override
- **widget (embed component)**: runs on **the host product's own domain** (e.g. `cardwhisper.com`), a cross-origin request — the browser sends the host page's origin, and the server has no FeedbackPort subdomain to work with. So widget requests must explicitly include `productSlug` in the body, and the server resolves the tenant from that. The corresponding endpoints need CORS enabled (`Access-Control-Allow-Origin: *`, since submitting feedback/voting are public, low-risk operations that carry no credentials worth protecting)

Admin endpoints aren't affected by this — they go through a login (Supabase Auth, this developer's account only) and don't need tenant resolution (they default to cross-product).

All public endpoints uniformly also require a Turnstile token.

## Public endpoints

### `POST /api/feedback` — submit feedback (called by the widget, cross-origin)

This endpoint supports cross-origin widget requests. `OPTIONS` preflight requests return `204`; `POST` responses (including validation and error responses) include the public CORS headers. Credentials are not used.

Request body:

```ts
{
  productSlug: string;    // required, identifies the tenant since host can't be relied on
  title: string;          // required, <= 120 chars
  body?: string;          // optional, <= 2000 chars
  submitterEmail: string; // required, must be a valid email
  turnstileToken: string; // required
  honeypot?: string;      // honeypot field — non-empty means silently drop the request
}
```

Processing order: zod schema validation (`packages/core` — fields have to be parsed out before there's a honeypot value to check) → honeypot check → Turnstile verification → IP rate limiting (Redis) → resolve the tenant by `productSlug` → insert into `feedback`.

Response: `201 { id, status: 'open' }`

### `GET /api/feedback?status=` — feedback list (called by the board, same-origin, tenant resolved from `x-tenant`)

- `status`: optional filter
- Returns the current list ordered by creation date; each item includes an aggregate vote count
- Public responses do not include submitter or voter email addresses.

### `POST /api/feedback/:id/vote` — vote

This endpoint supports the same cross-origin widget flow: `OPTIONS` returns `204`, and all `POST` responses include the public CORS headers.

Request body: `{ productSlug: string; voterEmail: string; turnstileToken: string }`

- Doesn't distinguish between board/widget callers — both are uniformly required to send `productSlug`, which is used to double-check before the write that this `feedback_id` really does belong to that tenant, preventing cross-tenant votes via a guessed id. That's more conservative than "trust `x-tenant` because it's a same-origin request," at the cost of the board also having to include this one extra field — worth it for the simplicity of a single schema/single code path
- A unique-constraint conflict (already voted) returns `200 { alreadyVoted: true }` rather than being treated as an error
- The rate-limit bar is looser than for submitting feedback, but it still goes through Turnstile

### `GET /api/feedback/:id` — feedback detail

Returns the feedback content plus its associated `replies` list (with an official-reply flag)
Submitter email addresses are not returned by this public endpoint.

## Admin endpoints (require login)

### `PATCH /api/admin/feedback/:id`

Request body: `{ status?: string; duplicateOf?: string }`

- Changes `status`, or assigns a dedup target via `duplicateOf`
- After a successful write, no notification logic is called directly (it's triggered asynchronously by a DB webhook, see ARCHITECTURE.md)

### `POST /api/admin/feedback/:id/reply`

Request body: `{ body: string }`

- Inserts into `replies` with `is_admin = true`
- Also doesn't call notification logic directly

### `GET /api/admin/feedback?product=&status=`

- The cross-product unified-inbox query — leaving `product` empty returns the aggregate across all products. This is the key difference from the public endpoints (which enforce single-tenant filtering, while the admin endpoint defaults to no filtering)

### `GET /api/admin/drafts?status=pending`

`status` is `pending` (default), `published` or `rejected`.

- Replies drafted through the MCP server and waiting for review (see [MCP.md](MCP.md)). Each item has the draft, the assistant's rationale, `contains_links`, and the original feedback and product
- Submitter emails are not returned
- Drafts are not replies: nothing in this list has been sent

### `POST /api/admin/drafts/:id/publish`

- Calls the `publish_reply_draft` SQL function, which flips the draft to `published` and inserts the `replies` row (`is_admin = true`) in one transaction
- Returns `201 { replyId }`. A draft that is not pending (already handled, or a double click) returns `409`, so one draft can never produce two replies or two emails
- The insert into `replies` triggers the usual notification webhook, exactly like a reply written by hand

### `POST /api/admin/drafts/:id/reject`

- Calls `reject_reply_draft`. Returns `{ ok: true }`, or `409` if the draft is not pending. Nothing is sent

## Widget init parameters

How a host page embeds it:

```html
<script
  src="https://cdn.domain.com/widget.js"
  data-api-base="https://feedback.domain.com"
  data-product="cardwhisper"
  data-turnstile-site-key="1x00000000000000000000AA"
  data-user-email="user@example.com"
  data-lang="en"
  async
></script>
```

- `data-product`: required, corresponds to `products.slug`
- `data-api-base`: optional API origin. Defaults to the widget script's origin; set it when the widget script is hosted on a separate CDN or domain from the FeedbackPort API.
- `data-lang`: optional `en` or `zh` override. By default, the widget follows the visitor's browser language and supports English and Simplified Chinese.
- `data-turnstile-site-key`: required, your Cloudflare Turnstile site key. For local development, Cloudflare publishes a well-known test key that always passes — `1x00000000000000000000AA` — so you don't need a real Cloudflare account to try the widget end to end
- `data-user-email`: optional — the host product's logged-in user's email, pre-fills the submission form so the user doesn't have to type it again (this is a lightweight substitute for a real SSO integration; the host page decides whether to pass it, and the widget performs no identity verification on it)

## Event-driven notification contract

Not a REST endpoint — a Supabase DB webhook configuration:

| Trigger | Target Edge Function | Behavior |
|---|---|---|
| Insert into `replies` with `is_admin = true` | `notify-submitter` | Looks up that item's `feedback.submitter_email` and sends a "your feedback got a new reply" email |
| Update to `feedback` where `status` changes | `notify-submitter` | Sends a "feedback status changed to XXX" email to the submitter and every voter (deduplicated email set) |

The Edge Function's input is the standard Supabase webhook payload (`{ type, table, record, old_record }`) — no extra request schema needs to be designed.

**One-time setup this repo can't automate** (verified against a real deployment — Supabase Studio has moved this around before, so if a menu item mentioned below isn't where you expect, search for "webhook"):

1. **Deploy the Edge Function.** Supabase Studio → Edge Functions → create one named exactly `notify-submitter`, paste in `supabase/functions/notify-submitter/index.ts`, deploy.
2. **Turn off "Verify JWT with legacy secret" for that function**, in its Settings tab. This function doesn't use Supabase's own JWT auth — and on newer projects using the `sb_publishable_`/`sb_secret_` key format, those keys aren't legacy-secret-signed JWTs anyway, so the check would just fail. Turning it off without adding anything else would leave the endpoint wide open to anyone who finds the URL (they could forge a webhook payload and turn your Resend account into an open relay), so the function checks its own shared secret instead — see step 4.
3. **Set the function's secrets** (Edge Functions → Secrets; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically, the rest need to be added by hand):
   - `RESEND_API_KEY` — without this the function no-ops (logs a warning, skips sending) instead of erroring, so the rest of the system keeps working if email isn't wired up yet
   - `NOTIFY_FROM_EMAIL` — an address at your verified sending domain
   - `WEBHOOK_SECRET` — any random string (`openssl rand -hex 32` is fine); this is the shared secret from step 2
4. **Create the Database Webhooks** — under Integrations → Database Webhooks (not directly under "Database" on newer Studio versions) → Webhooks tab → Create a new hook, twice:
   - table `replies`, event `Insert`, type "Supabase Edge Functions", target `notify-submitter`
   - table `feedback`, event `Update`, same target
   
   Both need an `x-webhook-secret` HTTP header set to the same value as `WEBHOOK_SECRET` above — this is the piece that can't ship as a migration or any other file in this repo, since the Edge Function's URL and the secret are project-specific.

---

# API 设计（中文）

## 两种调用方与租户识别方式

公开端点有两类调用方，租户（`product_id`）的识别方式不同，不能混用同一套逻辑：

- **board（公开面板）**：跑在 FeedbackPort 自己的子域名下（`<slug>.board.域名.com`），同源请求，租户由中间件从子域名解析后注入 `x-tenant`，客户端不可伪造覆盖
- **widget（嵌入组件）**：跑在**宿主产品自己的域名**上（比如 `cardwhisper.com`），是跨域请求，浏览器带的是宿主页面的 origin，服务端拿不到 FeedbackPort 子域名可用。因此 widget 请求必须显式在请求体带 `productSlug`，服务端据此解析租户；对应端点需要开放 CORS（`Access-Control-Allow-Origin: *`，因为提交反馈/投票是公开、低风险操作，不携带任何需要保密的凭证）

管理端点不受此影响，走登录态（Supabase Auth，仅开发者本人账号），不需要租户识别（默认跨产品）。

所有公开端点统一还需要 Turnstile token。

## 公开端点

### `POST /api/feedback` 提交反馈（widget 调用，跨域）

该端点支持 widget 跨域调用：`OPTIONS` 预检返回 `204`，`POST` 的成功和错误响应都会带公开 CORS 响应头；请求不使用凭证。

请求体：

```ts
{
  productSlug: string;    // 必填，标识租户，因为无法依赖 host
  title: string;          // 必填，<= 120 字符
  body?: string;          // 选填，<= 2000 字符
  submitterEmail: string; // 必填，邮箱格式
  turnstileToken: string; // 必填
  honeypot?: string;      // 蜜罐字段，非空则静默丢弃请求
}
```

处理顺序：zod schema 校验（`packages/core`，要先解出各字段才有蜜罐值可查）→ 蜜罐检查 → Turnstile 校验 → IP 频率限制（Redis）→ 按 `productSlug` 解析租户 → 写入 `feedback` 表。

响应：`201 { id, status: 'open' }`

### `GET /api/feedback?status=` 反馈列表（board 调用，同源，按 `x-tenant` 解析的租户）

- `status`：可选过滤
- 返回按创建时间倒序排列的列表，每项含聚合投票数
- 公开响应不包含提交者或投票者的邮箱地址

### `POST /api/feedback/:id/vote` 投票

该端点支持同样的 widget 跨域调用：`OPTIONS` 返回 `204`，`POST` 的所有响应都会带公开 CORS 响应头。

请求体：`{ productSlug: string; voterEmail: string; turnstileToken: string }`

- 不区分 board/widget 调用方，统一要求 `productSlug`——写入前用它二次核对该 `feedback_id` 确实属于这个租户，防止跨租户猜测 id 投票，比"同源请求就信任 x-tenant"更保守，代价是board 发起时也要多带这一个字段，用一套 schema/一条代码路径换来的简单性划算
- 唯一约束冲突（已投过票）时返回 `200 { alreadyVoted: true }`，不当作错误处理
- 频率限制门槛比提交反馈更宽松，但同样过 Turnstile

### `GET /api/feedback/:id` 反馈详情

返回反馈内容 + 关联 `replies` 列表（含官方回复标记）
该公开端点不会返回提交者邮箱。

## 管理端点（需登录）

### `PATCH /api/admin/feedback/:id`

请求体：`{ status?: string; duplicateOf?: string }`

- 改 `status` 或指派判重目标 `duplicateOf`
- 写入成功后不主动调用通知逻辑（由 DB Webhook 异步触发，见 ARCHITECTURE.md）

### `POST /api/admin/feedback/:id/reply`

请求体：`{ body: string }`

- 插入 `replies`，`is_admin = true`
- 同样不主动调用通知逻辑

### `GET /api/admin/feedback?product=&status=`

- 跨产品统一收件箱查询，`product` 留空即返回全部产品聚合结果，这是与公开端点的关键差异（公开端点强制单租户过滤，管理端点默认不过滤）

### `GET /api/admin/drafts?status=pending`

`status` 取 `pending`（默认）、`published` 或 `rejected`。

- 通过 MCP 服务器起草、等待审核的回复（见 [MCP.md](MCP.md)）。每一项包含草稿、助手给出的理由、`contains_links`，以及原始反馈和产品
- 不返回提交者邮箱
- 草稿不是回复：这个列表里的内容都没有发送过

### `POST /api/admin/drafts/:id/publish`

- 调用 SQL 函数 `publish_reply_draft`：在同一个事务里把草稿改为 `published` 并插入 `replies` 行（`is_admin = true`）
- 返回 `201 { replyId }`。草稿不是待审状态（已被处理或重复点击）时返回 `409`，所以一条草稿不会产生两条回复或两封邮件
- 插入 `replies` 会照常触发通知 webhook，和手写的回复完全一样

### `POST /api/admin/drafts/:id/reject`

- 调用 `reject_reply_draft`。返回 `{ ok: true }`，草稿不是待审状态时返回 `409`。不会发送任何内容

## Widget 初始化参数

宿主页面嵌入方式：

```html
<script
  src="https://cdn.域名.com/widget.js"
  data-api-base="https://feedback.域名.com"
  data-product="cardwhisper"
  data-turnstile-site-key="1x00000000000000000000AA"
  data-user-email="user@example.com"
  data-lang="zh"
  async
></script>
```

- `data-product`：必填，对应 `products.slug`
- `data-api-base`：选填，API 的 origin。默认使用 widget 脚本所在的 origin；当脚本托管在与 FeedbackPort API 不同的 CDN 或域名时，需要显式设置。
- `data-lang`：选填，可设为 `en` 或 `zh` 覆盖语言。默认跟随访问者的浏览器语言，支持英文和简体中文。
- `data-turnstile-site-key`：必填，你的 Cloudflare Turnstile site key。本地开发不需要真实 Cloudflare 账号——Cloudflare 官方发布了一个永远通过验证的测试 key：`1x00000000000000000000AA`，用这个就能把 widget 端到端跑通
- `data-user-email`：选填，宿主产品已登录用户的邮箱，预填提交表单，免去用户重复输入（这是替代真正 SSO 集成的轻量方案，宿主页面自行决定是否传递，widget 不做身份校验）

## 事件驱动通知契约

不是 REST 端点，而是 Supabase DB Webhook 配置：

| 触发条件 | 目标 Edge Function | 行为 |
|---|---|---|
| `replies` 表 insert 且 `is_admin = true` | `notify-submitter` | 查出该 `feedback.submitter_email`，发送"你的反馈有新回复"邮件 |
| `feedback` 表 update 且 `status` 变更 | `notify-submitter` | 发送"反馈状态变更为 XXX"邮件给提交者和所有投票者（去重后的邮箱集合） |

Edge Function 输入是 Supabase Webhook 的标准 payload（`{ type, table, record, old_record }`），不需要额外设计请求 schema。

**这个仓库自动化不了的一次性配置**（在真实项目上验证过的步骤——Supabase Studio 这块界面挪过位置，如果下面提到的菜单项找不到，直接搜 "webhook"）：

1. **部署 Edge Function**：Supabase 后台 → Edge Functions → 新建一个，名字精确填 `notify-submitter`，把 `supabase/functions/notify-submitter/index.ts` 的代码粘贴进去，部署。
2. **把这个函数的 "Verify JWT with legacy secret" 关掉**（在它的 Settings 标签页）。这个函数不走 Supabase 自己的 JWT 认证——而且新版项目用的 `sb_publishable_`/`sb_secret_` 这套 key 本来就不是 legacy secret 签发的 JWT，这个开关开着也校验不过。但只关掉不做别的，等于把这个接口完全暴露给任何知道 URL 的人（可以伪造 webhook 请求体，把你的 Resend 账号当垃圾邮件转发器），所以函数自己另外校验一个共享密钥，见第 4 步。
3. **给这个函数配 secrets**（Edge Functions → Secrets；`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 是 Supabase 自动注入的，其余要手动加）：
   - `RESEND_API_KEY` —— 没配的话函数不报错，只是记一条 warning 跳过发信，邮件通知没接好之前系统其余部分照样能用
   - `NOTIFY_FROM_EMAIL` —— 一个属于你已验证发信域名的地址
   - `WEBHOOK_SECRET` —— 随便一个随机字符串（`openssl rand -hex 32` 生成一个就行），这是第 2 步说的共享密钥
4. **建 Database Webhooks**——在 Integrations → Database Webhooks（新版 Studio 里不直接挂在 "Database" 底下）→ Webhooks 标签页 → Create a new hook，建两次：
   - 表 `replies`，事件 `Insert`，类型选 "Supabase Edge Functions"，目标 `notify-submitter`
   - 表 `feedback`，事件 `Update`，目标同上

   两个都要加一条 `x-webhook-secret` 的 HTTP Header，值跟上面的 `WEBHOOK_SECRET` 一致——这是唯一一步真的没法写进这个仓库的任何文件里的配置，因为 Edge Function 的 URL 和密钥都是项目专属的。
