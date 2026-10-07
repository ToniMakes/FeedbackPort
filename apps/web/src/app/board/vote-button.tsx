"use client";

import { useRef, useState } from "react";
import { getTurnstileToken } from "@/lib/turnstile-client";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * 投票的内联表单，替代早期用 window.prompt() 拿邮箱的占位实现——
 * Turnstile 需要一个常驻的 DOM 容器才能渲染挑战，prompt() 弹窗没有地方挂载它，
 * 所以先把交互改成这种"点击展开表单"的形态，再接真实 Turnstile。
 */
export function VoteButton({
  productSlug,
  feedbackId,
  onVoted,
}: {
  productSlug: string;
  feedbackId: string;
  onVoted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  async function handleVote() {
    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) {
      setStatus("error");
      return;
    }

    setStatus("verifying");
    try {
      const turnstileToken = await getTurnstileToken(turnstileContainerRef.current, TURNSTILE_SITE_KEY);
      const res = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug, voterEmail: email, turnstileToken }),
      });
      if (!res.ok) throw new Error("vote request failed");

      setOpen(false);
      setEmail("");
      setStatus("idle");
      onVoted?.();
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        ▲ 投票
      </button>
    );
  }

  return (
    <div className="card vote-panel w-64 flex flex-col gap-2 p-3 sm:w-72">
      <input
        type="email"
        required
        aria-label="你的邮箱（用于去重，不公开展示）"
        placeholder="你的邮箱（用于去重，不公开展示）"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input"
      />
      <div ref={turnstileContainerRef} />
      {status === "error" && <p className="alert-error">投票失败，请重试</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={status === "verifying" || !email}
          onClick={() => void handleVote()}
          className="btn-primary flex-1"
        >
          {status === "verifying" ? "验证中…" : "确认投票"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          取消
        </button>
      </div>
    </div>
  );
}
