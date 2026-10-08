"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useLanguage } from "@/components/language-provider";

/**
 * Admin login page. It lives at /login rather than /admin/login on purpose: inside app/admin/ it would be
 * covered by the login check in admin/layout.tsx, redirecting signed-out visitors to itself in an endless loop.
 */
export default function LoginPage() {
  const { copy } = useLanguage();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");

    const supabase = getSupabaseBrowserClient();
    // shouldCreateUser: false: only admin accounts that already exist in the Supabase project can sign in,
    // so arbitrary emails can't self-register via magic link; see docs/ARCHITECTURE.md, "Security boundaries"
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
              {copy.signInSent} <span className="font-medium text-slate-900 dark:text-slate-100">{email}</span>{copy.signInSentSuffix}
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
        <h1 className="text-center">{copy.adminSignIn}</h1>
        <p className="mt-2 text-center text-sm text-slate-500">{copy.signInHelper}</p>
        <form onSubmit={handleSubmit} className="card page-enter mt-6 flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="login-email">
              {copy.emailLabel}
            </label>
            <input
              id="login-email"
              type="email"
              required
              placeholder={copy.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
            />
          </div>
          {status === "error" && (
            <p className="alert-error">{copy.signInFailed}</p>
          )}
          <button type="submit" disabled={status === "sending"} className="btn-primary">
            {status === "sending" ? copy.sending : copy.sendSignInLink}
          </button>
        </form>
      </div>
    </main>
  );
}
