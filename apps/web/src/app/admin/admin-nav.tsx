"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useLanguage } from "@/components/language-provider";

export function AdminNav() {
  const router = useRouter();
  const { copy } = useLanguage();

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="admin-header border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-7">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            F
          </span>
          {copy.adminBrand}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/admin/drafts" className="btn-ghost">
            {copy.draftsNav}
          </Link>
          <Link href="/admin/products/new" className="btn-ghost">
            + {copy.addProduct}
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="btn-ghost">
            {copy.signOut}
          </button>
        </nav>
      </div>
    </header>
  );
}
