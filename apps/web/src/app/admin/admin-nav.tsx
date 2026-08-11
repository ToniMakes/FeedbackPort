"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AdminNav() {
  const router = useRouter();

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            F
          </span>
          FeedbackPort 管理后台
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/admin/products/new" className="btn-ghost">
            + 新增产品
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="btn-ghost">
            退出登录
          </button>
        </nav>
      </div>
    </header>
  );
}
