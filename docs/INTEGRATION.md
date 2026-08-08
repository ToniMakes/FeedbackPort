# Integration Guide

The playbook for "wiring FeedbackPort into a specific product." Written for you — or for you to hand straight to an AI coding assistant and have it follow along.

## Prerequisite: register the product first

Every product you integrate needs a row in the `products` table before it has a `slug` to use. Two ways to do that:

1. **Admin console** (the normal way): log into `/admin` → New Product → fill in slug (e.g. `cardwhisper`, lowercase letters/digits/hyphens only), name, brand_color
2. **Manual fallback**: insert a row directly via the Supabase Studio Table Editor, or run:

```sql
insert into products (slug, name, brand_color)
values ('cardwhisper', 'CardWhisper', '#6366f1');
```

You need the slug in hand before doing the integration steps below.

## 30-second integration (plain HTML / any static site)

Add one line before `</body>`:

```html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-product="cardwhisper"
  data-turnstile-site-key="1x00000000000000000000AA"
  async
></script>
```

`data-turnstile-site-key` is required — see [API.md](API.md#widget-init-parameters) for why, and note that `1x00000000000000000000AA` is Cloudflare's public test key (always passes), handy for trying this out before you have a real Turnstile site.

No extra init code needed — the script mounts a floating feedback entry point on its own.

## React / Next.js

```tsx
// components/FeedbackWidget.tsx
'use client';
import { useEffect } from 'react';

export function FeedbackWidget({
  productSlug,
  turnstileSiteKey,
  userEmail,
}: {
  productSlug: string;
  turnstileSiteKey: string;
  userEmail?: string;
}) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.your-domain.com/widget.js';
    script.async = true;
    script.dataset.product = productSlug;
    script.dataset.turnstileSiteKey = turnstileSiteKey;
    if (userEmail) script.dataset.userEmail = userEmail;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [productSlug, turnstileSiteKey, userEmail]);

  return null;
}
```

Usage: `<FeedbackWidget productSlug="cardwhisper" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} userEmail={session?.user?.email} />`, dropped into the root layout to take effect site-wide.

## Vue

```vue
<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps<{ productSlug: string; turnstileSiteKey: string; userEmail?: string }>();

onMounted(() => {
  const script = document.createElement('script');
  script.src = 'https://cdn.your-domain.com/widget.js';
  script.async = true;
  script.dataset.product = props.productSlug;
  script.dataset.turnstileSiteKey = props.turnstileSiteKey;
  if (props.userEmail) script.dataset.userEmail = props.userEmail;
  document.body.appendChild(script);
});
</script>
<template></template>
```

## WordPress / other sites where editing code isn't convenient

Theme editor → footer (footer.php, or a "custom HTML/JS" plugin) — paste in the same `<script>` from the 30-second integration above. No difference; the widget itself doesn't care what the host's tech stack is.

## Pre-filling the logged-in user's email

If the product already has its own login, pass the current user's email into `data-user-email` (see the React/Vue examples above) so users don't have to type it in when submitting feedback or voting. Leave it out and logged-out users just type it in manually — the two modes coexist without conflict. **This is not identity verification** — it just saves one input; the backend never checks whether that email actually belongs to the currently logged-in user.

## Public board URL

Once a product's slug is registered, it automatically gets a public voting board:

```
https://<slug>.board.your-domain.com
```

Feel free to drop this link straight into the product's "feedback" entry point, changelog footer, etc. — no extra deployment needed.

## About CORS

Widget requests to the API are cross-origin (host domain ≠ FeedbackPort domain). The backend already has CORS enabled for the submit-feedback and vote endpoints, so the host domain needs no extra configuration. If you're using Cloudflare Turnstile, remember to add the host product's domain to the allowed list in the Turnstile dashboard — otherwise verification will fail (this is the most common integration gotcha).

## Troubleshooting checklist

- Widget doesn't show up: check the browser console for a CSP (Content-Security-Policy) block on the `cdn.your-domain.com` script source — if the host site has a strict CSP, add this domain to `script-src`
- Submissions keep failing: first check the slug is spelled correctly (case-sensitive, must exactly match `products.slug`), then check the Turnstile domain allowlist
- Voting seems to do nothing: that's expected — the same email can only vote once per feedback item, and the API returns `alreadyVoted: true` instead of an error

## AI-assisted integration: a ready-to-copy prompt template

For routine new-product integrations, hand the following to an AI coding assistant (swap in the values for the placeholders in curly braces) and have it wire the widget into that project:

```
Help me integrate the FeedbackPort feedback widget into this project.

- The FeedbackPort product slug is: {cardwhisper}
- The Cloudflare Turnstile site key is: {your site key, or 1x00000000000000000000AA for local testing}
- This project's tech stack is: {Next.js App Router / plain static HTML / Vue / ...}
- Reference the integration guide at: https://github.com/{your-repo}/blob/main/docs/INTEGRATION.md
- If this project has a logged-in state, pass the current user's email to the widget's data-user-email
- Put the widget in the global layout so every page has a feedback entry point
- Once done, add a "Feedback" link to this project's README pointing to https://{cardwhisper}.board.your-domain.com
```

This prompt assumes the AI assistant can read `docs/INTEGRATION.md` (paste it into context, or give it the repo link) — you shouldn't have to re-explain the integration logic every time.

---

# 接入指南（中文）

给"要把 FeedbackPort 接进某个具体产品"的场景用的操作手册。目标读者是你自己（或者你直接把这份文档丢给 AI 编程助手，让它照着做）。

## 前提：先注册产品

每个要接入的产品都要在 `products` 表里有一行，才有 `slug` 可用。两种方式：

1. **管理后台**（正常方式）：登录 `/admin` → 新增产品 → 填 slug（比如 `cardwhisper`，只能小写字母数字连字符）、name、brand_color
2. **手动兜底方式**：直接在 Supabase Studio 的 Table Editor 里插一行，或者跑：

```sql
insert into products (slug, name, brand_color)
values ('cardwhisper', 'CardWhisper', '#6366f1');
```

拿到 slug 之后才能进行下面的接入步骤。

## 30 秒接入（纯 HTML / 任意静态站）

在 `</body>` 前加一行：

```html
<script
  src="https://cdn.你的域名.com/widget.js"
  data-product="cardwhisper"
  data-turnstile-site-key="1x00000000000000000000AA"
  async
></script>
```

`data-turnstile-site-key` 是必填的，为什么见 [API.md](API.md#widget-初始化参数)；`1x00000000000000000000AA` 是 Cloudflare 官方的公开测试 key（永远通过），在还没有真实 Turnstile site 之前先用这个跑通。

不需要额外初始化代码，脚本自己会在页面上挂一个悬浮反馈入口。

## React / Next.js

```tsx
// components/FeedbackWidget.tsx
'use client';
import { useEffect } from 'react';

export function FeedbackWidget({
  productSlug,
  turnstileSiteKey,
  userEmail,
}: {
  productSlug: string;
  turnstileSiteKey: string;
  userEmail?: string;
}) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.你的域名.com/widget.js';
    script.async = true;
    script.dataset.product = productSlug;
    script.dataset.turnstileSiteKey = turnstileSiteKey;
    if (userEmail) script.dataset.userEmail = userEmail;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [productSlug, turnstileSiteKey, userEmail]);

  return null;
}
```

用法：`<FeedbackWidget productSlug="cardwhisper" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} userEmail={session?.user?.email} />`，放在根布局里即可全站生效。

## Vue

```vue
<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps<{ productSlug: string; turnstileSiteKey: string; userEmail?: string }>();

onMounted(() => {
  const script = document.createElement('script');
  script.src = 'https://cdn.你的域名.com/widget.js';
  script.async = true;
  script.dataset.product = props.productSlug;
  script.dataset.turnstileSiteKey = props.turnstileSiteKey;
  if (props.userEmail) script.dataset.userEmail = props.userEmail;
  document.body.appendChild(script);
});
</script>
<template></template>
```

## WordPress / 其他不方便改代码的站点

主题编辑器 → 页脚（footer.php 或"自定义 HTML/JS"插件）里贴 30 秒接入那段 `<script>`，没有区别，widget 本身不关心宿主是什么技术栈。

## 已登录用户邮箱预填

如果产品自己有登录态，把当前用户邮箱传进 `data-user-email`（见上面 React/Vue 示例），用户提交反馈/投票时就不用手动填邮箱了。不传就是匿名用户手动填，两种方式共存不冲突。**这不是身份校验**，只是省一次输入，后端不会验证这个邮箱是否真的属于当前登录用户。

## 公开面板地址

产品注册完 slug 之后，自动就有一个公开投票板：

```
https://<slug>.board.你的域名.com
```

可以直接把这个链接放进产品的"意见反馈"入口、更新日志页脚等位置，不需要额外部署。

## 关于跨域

widget 请求 API 是跨域请求（宿主域名 ≠ FeedbackPort 域名），后端已对提交反馈/投票这两个端点开放 CORS，宿主域名不需要额外配置。如果用了 Cloudflare Turnstile，注意在 Turnstile 控制台把宿主产品的域名加进允许列表，否则验证会失败（这是最常见的接入踩坑点）。

## 排查清单

- Widget 没显示：看浏览器控制台有没有 CSP（Content-Security-Policy）拦截了 `cdn.你的域名.com` 这个脚本源，宿主站如果配了严格 CSP 需要把这个域名加进 `script-src`
- 提交一直失败：先看 slug 是不是拼对了（大小写敏感、要和 `products.slug` 完全一致），再看 Turnstile 域名白名单
- 投票不生效：正常，同一个邮箱对同一条反馈只能投一次，接口会返回 `alreadyVoted: true` 而不是报错

## AI 辅助接入：可直接复制的提示词模板

日常接入新产品时，可以把下面这段丢给 AI 编程助手（替换掉花括号里的占位符），让它去对应项目里把 widget 接进去：

```
帮我把 FeedbackPort 反馈组件接入这个项目。

- FeedbackPort 的 product slug 是：{cardwhisper}
- Cloudflare Turnstile 的 site key 是：{你的 site key，本地测试可以用 1x00000000000000000000AA}
- 这个项目的技术栈是：{Next.js App Router / 纯静态 HTML / Vue / ...}
- 参考接入方式见：https://github.com/{你的仓库}/blob/main/docs/INTEGRATION.md
- 如果项目里有登录态，把当前登录用户的邮箱传给 widget 的 data-user-email
- 把 widget 放在全局布局里，确保每个页面都能看到反馈入口
- 接完之后帮我在这个项目的 README 里加一行"用户反馈"链接，指向 https://{cardwhisper}.board.你的域名.com
```

这份提示词假设 AI 助手能读取 `docs/INTEGRATION.md` 的内容（贴进上下文或给它仓库链接），不需要每次重新解释一遍接入逻辑。
