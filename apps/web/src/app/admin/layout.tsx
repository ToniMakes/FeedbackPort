import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { AdminNav } from "./admin-nav";

/** 保护 /admin/** 下所有路由，未登录一律跳 /login，见 src/app/login/page.tsx 顶部的注释 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <AdminNav />
      {children}
    </div>
  );
}
