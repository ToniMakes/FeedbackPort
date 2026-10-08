# Frontend updates

A summary of the frontend work shipped on top of the Phase 0 MVP. The code is the source of truth; this page records the intent.

## Design system

- One flat, restrained visual language shared by the public board, admin console, login page, home page, and the embedded widget (`apps/web/src/app/globals.css`, `packages/widget/src/ui.ts`).
- Motion is short and functional (the widget panel fades in; list items settle). All of it is disabled under `prefers-reduced-motion`.

## Public board

- Search, sort (newest / most votes), and status filter on `/board`. Sorting by votes happens client-side because the list is not paginated.
- Voting is an inline click-to-expand form with a real Turnstile challenge; the email is used only to prevent duplicate votes and is never shown publicly.
- Copy leads with the task: look for an existing idea before submitting a new one, and say what happens to the email address next to the field.

## Admin console

- Product-first navigation: `/admin` lists products with pending counts; `/admin/products/[slug]` is the per-product inbox; `/admin/all` keeps the cross-product unified inbox.
- Status changes and replies stay in the inbox rows; email notifications are triggered by database webhooks, not by the UI (see ARCHITECTURE.md).

## Language

- English is the primary interface language, with a complete Simplified Chinese localization chosen from the visitor's `Accept-Language` header (`apps/web/src/lib/ui-copy.ts`, `components/language-provider.tsx`).
- The widget follows the browser language and accepts `data-lang="en|zh"` to override it.
- Code comments, validation errors, and notification emails are English.

---

# 前端更新

记录在 Phase 0 MVP 之上完成的前端工作。以代码为准，本页只记录意图。

## 设计系统

- 公开面板、管理后台、登录页、首页和嵌入组件统一为克制的平面风格（`apps/web/src/app/globals.css`、`packages/widget/src/ui.ts`）。
- 动效简短且有功能意义（组件面板淡入、列表项落位），在 `prefers-reduced-motion` 下全部关闭。

## 公开面板

- `/board` 提供搜索、排序（最新 / 最多票数）和状态筛选。列表尚未分页，所以按票数排序在客户端完成。
- 投票是内联展开的表单，带真实的 Turnstile 挑战；邮箱只用于防止重复投票，不会公开显示。
- 文案以任务为先：提交新想法前先查找已有想法，并在输入框旁说明邮箱的用途。

## 管理后台

- 产品优先导航：`/admin` 列出产品及待处理数，`/admin/products/[slug]` 是单产品收件箱，`/admin/all` 保留跨产品统一收件箱。
- 改状态和回复都在收件箱行内完成；邮件通知由数据库 Webhook 触发，不由界面触发（见 ARCHITECTURE.md）。

## 语言

- 英文是主要界面语言，并提供完整的简体中文本地化，根据访问者的 `Accept-Language` 选择（`apps/web/src/lib/ui-copy.ts`、`components/language-provider.tsx`）。
- 嵌入组件跟随浏览器语言，可用 `data-lang="en|zh"` 覆盖。
- 代码注释、校验错误和通知邮件使用英文。
