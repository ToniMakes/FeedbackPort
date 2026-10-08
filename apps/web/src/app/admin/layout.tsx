import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { AdminNav } from "./admin-nav";

/** Protects every route under /admin/**; signed-out visitors are redirected to /login (see the comment at the top of src/app/login/page.tsx) */
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
