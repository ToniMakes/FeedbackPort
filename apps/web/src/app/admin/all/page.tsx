"use client";

import Link from "next/link";
import { FeedbackInbox } from "../feedback-inbox";
import { useLanguage } from "@/components/language-provider";

/** 跨产品统一收件箱，见 docs/ARCHITECTURE.md「跨产品统一收件箱」。管理后台首页改成产品优先导航后，这是保留"一眼看完所有产品"的入口。 */
export default function AdminAllFeedbackPage() {
  const { copy } = useLanguage();
  return (
    <main className="shell-wide page-enter">
      <Link href="/admin" className="link text-sm">
        {copy.backToProducts}
      </Link>
      <p className="eyebrow mt-5 mb-2">{copy.workspaceInbox}</p>
      <h1 className="text-3xl">{copy.allFeedback}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.allFeedbackHelper}</p>

      <div className="mt-6">
        <FeedbackInbox />
      </div>
    </main>
  );
}
