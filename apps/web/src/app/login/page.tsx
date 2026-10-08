"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * 管理后台登录页，故意放在 /login 而不是 /admin/login——如果放进 app/admin/ 目录，
 * 会被 admin/layout.tsx 的登录态检查连带保护，导致未登录时重定向到自己，死循环。
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");

    const supabase = getSupabaseBrowserClient();
    // shouldCreateUser: false —— 只有 Supabase 项目里已存在的管理员账号能登录，
    // 防止任意邮箱靠 magic link 自助注册，见 docs/ARCHITECTURE.md「安全边界」
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="shell max-w-sm text-center">
          <div className="card page-enter">
            <p className="text-sm leading-6 text-slate-700">
              A sign-in link was sent to <span className="font-medium text-slate-900 dark:text-slate-100">{email}</span>. Open it to continue.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="shell max-w-sm">
        <p className="eyebrow mb-3 text-center">FeedbackPort</p>
        <h1 className="text-center">Admin sign in</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Get a one-time sign-in link at your administrator email address.</p>
        <form onSubmit={handleSubmit} className="card page-enter mt-6 flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
            />
          </div>
          {status === "error" && (
            <p className="alert-error">Could not send the link. Make sure this email is set up as an administrator in the Supabase project.</p>
          )}
          <button type="submit" disabled={status === "sending"} className="btn-primary">
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      </div>
    </main>
  );
}
