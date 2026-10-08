# Integration Guide

Connect a product to FeedbackPort with a public board or an embedded feedback widget.

## Prerequisite: register the product first

Every product you integrate needs a row in the `products` table before it has a `slug` to use. Two ways to do that:

1. **Admin console**: sign in to `/admin` → Add product → enter a slug (for example, `cardwhisper`), product name, and brand color
2. **Supabase Studio**: insert a row in the Table Editor, or run:

```sql
insert into products (slug, name, brand_color)
values ('cardwhisper', 'CardWhisper', '#6366f1');
```

You need the slug in hand before doing the integration steps below.

## 30-second integration (plain HTML / any static site)

Add this script before `</body>`. Replace the example URLs, product slug, and key with your deployment values:

```html
<script
  src="https://cdn.your-domain.com/widget.js"
  data-api-base="https://feedback.your-domain.com"
  data-product="cardwhisper"
  data-turnstile-site-key="1x00000000000000000000AA"
  data-lang="en"
  async
></script>
```

`data-turnstile-site-key` is required. `1x00000000000000000000AA` is Cloudflare's public test key for local trials; use your own site key in production. The widget follows the visitor's browser language (English or Simplified Chinese) unless `data-lang="en"` or `data-lang="zh"` is set.

The script mounts a floating feedback button. The optional `data-api-base` defaults to the script's origin; set it if the widget and FeedbackPort API use different domains.

## React / Next.js

```tsx
// components/FeedbackWidget.tsx
'use client';
import { useEffect } from 'react';

export function FeedbackWidget({
  productSlug,
  turnstileSiteKey,
  apiBase,
  lang,
  userEmail,
}: {
  productSlug: string;
  turnstileSiteKey: string;
  apiBase: string;
  lang?: 'en' | 'zh';
  userEmail?: string;
}) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.your-domain.com/widget.js';
    script.async = true;
    script.dataset.product = productSlug;
    script.dataset.turnstileSiteKey = turnstileSiteKey;
    script.dataset.apiBase = apiBase;
    if (lang) script.dataset.lang = lang;
    if (userEmail) script.dataset.userEmail = userEmail;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [productSlug, turnstileSiteKey, apiBase, lang, userEmail]);

  return null;
}
```

Usage: `<FeedbackWidget productSlug="cardwhisper" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} apiBase="https://feedback.your-domain.com" lang="en" userEmail={session?.user?.email} />`, placed in the root layout to show the widget across the site.

## Vue

```vue
<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps<{ productSlug: string; turnstileSiteKey: string; apiBase: string; lang?: 'en' | 'zh'; userEmail?: string }>();

onMounted(() => {
  const script = document.createElement('script');
  script.src = 'https://cdn.your-domain.com/widget.js';
  script.async = true;
  script.dataset.product = props.productSlug;
  script.dataset.turnstileSiteKey = props.turnstileSiteKey;
  script.dataset.apiBase = props.apiBase;
  if (props.lang) script.dataset.lang = props.lang;
  if (props.userEmail) script.dataset.userEmail = props.userEmail;
  document.body.appendChild(script);
});
</script>
<template></template>
```

## WordPress / other sites where editing code isn't convenient

Theme editor → footer (footer.php, or a "custom HTML/JS" plugin) — paste in the same `<script>` from the 30-second integration above. No difference; the widget itself doesn't care what the host's tech stack is.

## Pre-filling the logged-in user's email

If the product already has its own login, pass the current user's email into `data-user-email` (see the React/Vue examples above) so users don't have to type it when submitting feedback. Leave it out and users can enter it themselves. **This is not identity verification** — it only pre-fills a field; the backend does not check whether the email belongs to the logged-in user.

## Public board URL

Once a product's slug is registered, it automatically gets a public voting board:

```
https://<slug>.board.your-domain.com
```

Feel free to drop this link straight into the product's "feedback" entry point, changelog footer, etc. — no extra deployment needed.

For the current staging environment, the AI Agent Quota Dashboard board is at `https://aiqd.board.fp-staging.tonimakes.com/board`. The embeddable widget is served from `https://fp-staging.tonimakes.com/widget.js`; set `data-api-base` to `https://fp-staging.tonimakes.com` when embedding it on another site.

## About CORS

Widget requests to the API are cross-origin when the host and FeedbackPort use different domains. The feedback and vote endpoints answer `OPTIONS` preflight requests and include CORS headers on their `POST` responses. Add the host product's domain to the Cloudflare Turnstile allowed-hostname list or verification will fail.

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

将产品连接到 FeedbackPort：可以接入公开面板，也可以嵌入反馈组件。

## 前提：先注册产品

每个要接入的产品都要在 `products` 表里有一行，才有 `slug` 可用。两种方式：

1. **管理后台**：登录 `/admin` → 新增产品 → 填写 slug（例如 `cardwhisper`）、产品名称和品牌色
2. **Supabase Studio**：在 Table Editor 里插入一行，或者运行：

```sql
insert into products (slug, name, brand_color)
values ('cardwhisper', 'CardWhisper', '#6366f1');
```

拿到 slug 之后才能进行下面的接入步骤。

## 30 秒接入（纯 HTML / 任意静态站）

在 `</body>` 前加入下面的脚本，并将示例网址、产品 slug 和密钥替换为自己的部署配置：

```html
<script
  src="https://cdn.你的域名.com/widget.js"
  data-api-base="https://feedback.你的域名.com"
  data-product="cardwhisper"
  data-turnstile-site-key="1x00000000000000000000AA"
  data-lang="zh"
  async
></script>
```

`data-turnstile-site-key` 必填。`1x00000000000000000000AA` 是 Cloudflare 提供的公开测试 key，可用于本地试用；生产环境请换成自己的 site key。组件默认跟随访问者的浏览器语言（英文或简体中文），也可以通过 `data-lang="en"` 或 `data-lang="zh"` 指定语言。

脚本会在页面上挂载悬浮反馈按钮。若 widget 和 FeedbackPort API 使用不同域名，请通过 `data-api-base` 指定 API 地址；省略时默认使用脚本所在域名。

## React / Next.js

```tsx
// components/FeedbackWidget.tsx
'use client';
import { useEffect } from 'react';

export function FeedbackWidget({
  productSlug,
  turnstileSiteKey,
  apiBase,
  lang,
  userEmail,
}: {
  productSlug: string;
  turnstileSiteKey: string;
  apiBase: string;
  lang?: 'en' | 'zh';
  userEmail?: string;
}) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.你的域名.com/widget.js';
    script.async = true;
    script.dataset.product = productSlug;
    script.dataset.turnstileSiteKey = turnstileSiteKey;
    script.dataset.apiBase = apiBase;
    if (lang) script.dataset.lang = lang;
    if (userEmail) script.dataset.userEmail = userEmail;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [productSlug, turnstileSiteKey, apiBase, lang, userEmail]);

  return null;
}
```

用法：`<FeedbackWidget productSlug="cardwhisper" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} apiBase="https://feedback.你的域名.com" lang="zh" userEmail={session?.user?.email} />`，放在根布局里即可全站显示。

## Vue

```vue
<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps<{ productSlug: string; turnstileSiteKey: string; apiBase: string; lang?: 'en' | 'zh'; userEmail?: string }>();

onMounted(() => {
  const script = document.createElement('script');
  script.src = 'https://cdn.你的域名.com/widget.js';
  script.async = true;
  script.dataset.product = props.productSlug;
  script.dataset.turnstileSiteKey = props.turnstileSiteKey;
  script.dataset.apiBase = props.apiBase;
  if (props.lang) script.dataset.lang = props.lang;
  if (props.userEmail) script.dataset.userEmail = props.userEmail;
  document.body.appendChild(script);
});
</script>
<template></template>
```

## WordPress / 其他不方便改代码的站点

主题编辑器 → 页脚（footer.php 或"自定义 HTML/JS"插件）里贴 30 秒接入那段 `<script>`，没有区别，widget 本身不关心宿主是什么技术栈。

## 已登录用户邮箱预填

如果产品自己有登录态，可以把当前用户邮箱传进 `data-user-email`（见上面 React/Vue 示例），这样用户提交反馈时就不用重复填写。不传时，用户可以自行填写。**这不是身份校验**，只会预填邮箱；后端不会验证邮箱是否属于当前登录用户。

## 公开面板地址

产品注册完 slug 之后，自动就有一个公开投票板：

```
https://<slug>.board.你的域名.com
```

当前 staging 环境的 AI Agent Quota Dashboard 面板地址是 `https://aiqd.board.fp-staging.tonimakes.com/board`。可嵌入的 widget 从 `https://fp-staging.tonimakes.com/widget.js` 提供；嵌入其他网站时将 `data-api-base` 设为 `https://fp-staging.tonimakes.com`。

可以直接把这个链接放进产品的"意见反馈"入口、更新日志页脚等位置，不需要额外部署。

## 关于跨域

宿主与 FeedbackPort 使用不同域名时，widget 请求属于跨域请求。提交反馈和投票端点会响应 `OPTIONS` 预检请求，并在 `POST` 响应中包含 CORS 响应头。请在 Cloudflare Turnstile 的允许主机名列表中加入宿主产品域名，否则验证会失败。

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
