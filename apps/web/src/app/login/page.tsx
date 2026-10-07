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
              登录链接已经发到 <span className="font-medium text-slate-900 dark:text-slate-100">{email}</span>，去邮箱里点一下。
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
        <h1 className="text-center">登录管理后台</h1>
        <p className="mt-2 text-center text-sm text-slate-500">使用管理员邮箱接收一次性登录链接。</p>
        <form onSubmit={handleSubmit} className="card page-enter mt-6 flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="login-email">
              邮箱
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
            <p className="alert-error">发送失败——确认这个邮箱已经在 Supabase 项目里建好管理员账号。</p>
          )}
          <button type="submit" disabled={status === "sending"} className="btn-primary">
            {status === "sending" ? "发送中…" : "发送登录链接"}
          </button>
        </form>
      </div>
    </main>
  );
}
