"use client";

import Link from "next/link";
import { FeedbackInbox } from "../feedback-inbox";

/** 跨产品统一收件箱，见 docs/ARCHITECTURE.md「跨产品统一收件箱」。管理后台首页改成产品优先导航后，这是保留"一眼看完所有产品"的入口。 */
export default function AdminAllFeedbackPage() {
  return (
    <main className="shell-wide page-enter">
      <Link href="/admin" className="link text-sm">
        ← 返回产品列表
      </Link>
      <p className="eyebrow mt-5 mb-2">Workspace inbox</p>
      <h1 className="text-3xl">跨产品全部反馈</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">默认聚合所有产品的反馈，无需逐个登录切换。</p>

      <div className="mt-6">
        <FeedbackInbox />
      </div>
    </main>
  );
}
