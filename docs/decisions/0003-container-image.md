# ADR 0003: Container Image for the Web App

- Status: Accepted
- Date: 2026-10-07
- Depends on: [0002-tech-stack](0002-tech-stack.md)

## Context

`apps/web` runs on Vercel today. To run the same app on AWS (see the upcoming deployment ADRs) we need a reproducible container image. Three constraints from the codebase shape the design:

1. **pnpm monorepo.** `apps/web` imports `@feedbackport/core`, whose entry point is TypeScript source (`main: ./src/index.ts`). The image must contain it.
2. **`NEXT_PUBLIC_*` variables are inlined at build time.** Next.js replaces them in the client bundle during `next build`; setting them when the container starts has no effect on the browser code.
3. **Server secrets must never be baked into an image.** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS; `TURNSTILE_SECRET_KEY` and `UPSTASH_REDIS_REST_TOKEN` are also sensitive.

## Decision

- **Multi-stage `Dockerfile` at the repo root** (`deps` → `build` → `runner`), based on a pinned-major `node:22-bookworm-slim`. The final stage contains only Next.js's traced `standalone` output plus static assets, and runs as the non-root `node` user.
- **`output: "standalone"` is opt-in via `NEXT_OUTPUT=standalone`**, set only inside the Dockerfile. Standalone tracing creates symlinks, which fails with `EPERM` on Windows without elevated rights (we hit this), and neither Vercel nor local `pnpm build` needs it. `outputFileTracingRoot` points at the repo root so workspace packages are traced into the image.
- **`NEXT_PUBLIC_*` values are passed as Docker build args** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). They are public by design (they ship to every browser), so build args are acceptable here.
- **Server secrets are injected at runtime only** (environment variables supplied by the orchestrator). They are not build args, are not copied into any layer, and `.dockerignore` excludes every `.env*` file except `.env.example`.
- **`GET /api/health`** returns `{"status":"ok"}` and deliberately does not touch the database: a Supabase blip should not make the load balancer kill and restart healthy containers, and the endpoint must not leak internals. The image also declares a Docker `HEALTHCHECK` against it.

## Trade-offs

- Because public values are baked in, **the image is bound to one environment**: staging and production need separate builds. We lose the "build once, promote the same artifact" property. Accepted: there is a single deployed environment on AWS, and the alternative (runtime config injection into the client) would require application code changes for no present benefit. Revisit if a second AWS environment appears.
- `node:22-bookworm-slim` (glibc) is larger than Alpine but avoids musl compatibility surprises with `sharp`. Pinning by digest is deferred to the CI/CD stage so the pipeline can update it deliberately.

## Verification (2026-10-07, local Docker Desktop)

- Image builds from a cold cache in ~5 minutes; final image is ~411 MB.
- Container runs as `uid=1000(node)`; Docker health status reaches `healthy`; `/api/health` returns 200.
- Runtime-only secrets passed with `docker run -e` were not found anywhere in the saved image; `docker history` shows no secret-like strings.
- A public build arg (Turnstile site key) was found in the client bundle, confirming build-time inlining.

---

# ADR 0003：Web 应用的容器镜像（中文）

- 状态：已采纳
- 日期：2026-10-07
- 依赖：[0002-tech-stack](0002-tech-stack.md)

## 背景

`apps/web` 目前跑在 Vercel 上。要让同一个应用也能跑在 AWS 上，需要一个可复现的容器镜像。代码库有三个约束：

1. **pnpm monorepo。** `apps/web` 引用 `@feedbackport/core`，而它的入口是 TypeScript 源码（`main: ./src/index.ts`），镜像里必须带上它。
2. **`NEXT_PUBLIC_*` 在构建时内联。** Next.js 在 `next build` 时就把它们替换进前端代码，容器启动时再设置对浏览器代码没有任何作用。
3. **服务端密钥绝不能烤进镜像。** `SUPABASE_SERVICE_ROLE_KEY` 能绕过 RLS，`TURNSTILE_SECRET_KEY` 和 `UPSTASH_REDIS_REST_TOKEN` 同样敏感。

## 决策

- **仓库根目录一个多阶段 `Dockerfile`**（`deps` → `build` → `runner`），基础镜像固定大版本 `node:22-bookworm-slim`。最终阶段只含 Next.js 追踪出的 `standalone` 产物和静态资源，以非 root 的 `node` 用户运行。
- **`output: "standalone"` 通过 `NEXT_OUTPUT=standalone` 按需开启**，只在 Dockerfile 里设置。standalone 追踪文件时要创建符号链接，在没有管理员权限的 Windows 上会报 `EPERM`（我们实际遇到了），而 Vercel 和本地 `pnpm build` 都不需要它。`outputFileTracingRoot` 指向仓库根，workspace 包才会被打进镜像。
- **`NEXT_PUBLIC_*` 用 Docker 构建参数传入**（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_TURNSTILE_SITE_KEY`）。它们本来就是公开的（会发给每个浏览器），所以用构建参数可以接受。
- **服务端密钥只在运行时注入**（由编排平台提供环境变量）。它们不是构建参数，不会进入任何镜像层，`.dockerignore` 排除除 `.env.example` 外的所有 `.env*` 文件。
- **`GET /api/health`** 返回 `{"status":"ok"}`，刻意不查数据库：Supabase 抖一下不应该让负载均衡器把健康的容器杀掉重启，并且不能泄露内部信息。镜像同时声明了指向它的 Docker `HEALTHCHECK`。

## 取舍

- 公开值被烤进镜像，所以**镜像绑定单一环境**：预发布和生产需要分别构建，失去了"一次构建、多环境晋升"。可以接受：AWS 上目前只有一个部署环境，而替代方案（运行时向前端注入配置）需要改应用代码，眼下没有收益。出现第二个 AWS 环境时再重新评估。
- `node:22-bookworm-slim`（glibc）比 Alpine 大，但能避开 `sharp` 的 musl 兼容问题。按 digest 固定基础镜像留到 CI/CD 阶段，由流水线有意识地更新。

## 验证（2026-10-07，本机 Docker Desktop）

- 冷缓存构建约 5 分钟，最终镜像约 411 MB。
- 容器以 `uid=1000(node)` 运行；Docker 健康状态变为 `healthy`；`/api/health` 返回 200。
- 用 `docker run -e` 传入的仅运行时密钥，在导出的镜像里搜不到；`docker history` 里没有疑似密钥的字符串。
- 在前端 bundle 里找到了公开的构建参数（Turnstile site key），确认构建时内联。
