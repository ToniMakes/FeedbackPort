# ADR 0007: Revoke Direct Anonymous Access to Data Tables

- Status: Accepted
- Date: 2026-10-09

## Context

Migrations 0001 and 0002 gave the `anon` role `select` on every column of `feedback`, `votes`, `replies` and `products`, plus `insert` on `feedback` and `votes`, with permissive RLS policies (`using (true)` / `with check (true)`). Supabase exposes tables through PostgREST, and the anon key is public by design (it ships in the browser bundle). In practice that meant:

- anyone with the anon key could read `feedback.submitter_email` and `votes.voter_email`, reproduced against a local instance with `GET /rest/v1/feedback?select=submitter_email`;
- anyone could `POST /rest/v1/feedback` directly, which skips the honeypot, Turnstile and Redis rate limiting that exist only in the Next.js API Routes.

The application does not rely on either path. Every board, widget and admin request goes through API Routes holding the service-role key; the Supabase browser and server clients are used for admin sign-in only.

## Decision

- Drop all anonymous RLS policies and revoke all privileges of `anon` and `authenticated` on `products`, `feedback`, `votes` and `replies`. RLS stays enabled, so the default is deny.
- Revoke the default `anon`/`authenticated` privileges for future tables in `public`, so new tables are private until a migration opens them.
- Keep the `service_role` grants explicit.
- Add a pgTAP regression test (`supabase/tests/database/anon_access.test.sql`, run by `npx supabase test db` and in CI).
- Prefer a column-level `revoke` or moving emails to a separate table only if a future feature needs anonymous reads; the current design needs none.

## Consequences

The public anon key can no longer read emails or write rows. Behaviour of the board, widget and admin console is unchanged because they never used those privileges. Self-hosters who run their own Supabase project must apply the new migration (`supabase db push` or the deployment guide's migration step); until then, the exposure remains on that project. Any external client that queried PostgREST directly with the anon key will stop working, which is intended. New features that need anonymous access (for example Supabase Realtime) must add an explicit, narrow grant and policy and update the regression test.

---

# ADR 0007：撤销匿名角色对数据表的直接访问

- 状态：已采纳
- 日期：2026-10-09

## 背景

迁移 0001 和 0002 给 `anon` 角色开放了 `feedback`、`votes`、`replies`、`products` 全部列的 `select`，以及 `feedback`、`votes` 的 `insert`，对应的 RLS policy 是 `using (true)` / `with check (true)`。Supabase 通过 PostgREST 暴露表，而 anon key 按设计就是公开的（会打包进浏览器代码）。实际后果是：

- 任何人拿 anon key 就能读取 `feedback.submitter_email` 和 `votes.voter_email`，已在本地实例上用 `GET /rest/v1/feedback?select=submitter_email` 复现；
- 任何人可以直接 `POST /rest/v1/feedback`，绕过只存在于 Next.js API Route 里的蜜罐、Turnstile 和 Redis 限流。

应用本身并不依赖这两条路径：面板、嵌入组件、管理后台的请求都经由持有 service-role 密钥的 API Route，Supabase 的浏览器端和服务端 client 只用于管理员登录。

## 决策

- 删除所有匿名 RLS policy，撤销 `anon` 和 `authenticated` 在 `products`、`feedback`、`votes`、`replies` 上的全部权限。RLS 保持开启，默认拒绝。
- 撤销 `public` schema 中今后新建表默认授予 `anon`/`authenticated` 的权限，新表在迁移明确开放之前保持私有。
- `service_role` 的授权保持显式。
- 增加 pgTAP 回归测试（`supabase/tests/database/anon_access.test.sql`，通过 `npx supabase test db` 运行，并接入 CI）。
- 只有将来有功能确实需要匿名读取时，才考虑列级 `revoke` 或把邮箱拆到单独的表；目前的设计不需要。

## 影响

公开的 anon key 不再能读取邮箱或写入数据。面板、嵌入组件和管理后台的行为不变，因为它们从未用过这些权限。自行托管 Supabase 项目的使用者必须应用这条新迁移（`supabase db push` 或部署指南中的迁移步骤），在此之前该项目仍存在暴露。任何直接用 anon key 查询 PostgREST 的外部客户端将不再可用，这是预期结果。今后需要匿名访问的新功能（例如 Realtime）必须显式加上范围很窄的授权和 policy，并同步更新回归测试。
