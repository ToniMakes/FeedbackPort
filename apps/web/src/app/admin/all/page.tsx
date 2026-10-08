"use client";

import Link from "next/link";
import { FeedbackInbox } from "../feedback-inbox";
import { useLanguage } from "@/components/language-provider";

/** Cross-product unified inbox; see docs/ARCHITECTURE.md, "Cross-product unified inbox". After the admin home moved to product-first navigation, this is the entry point that keeps the "see everything at a glance" view. */
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
