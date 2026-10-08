"use client";

import { useRef, useState } from "react";
import { getTurnstileToken } from "@/lib/turnstile-client";
import { useLanguage } from "@/components/language-provider";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Inline form for voting, replacing the early window.prompt() placeholder used to collect the email:
 * Turnstile needs a persistent DOM container to render its challenge into, and a prompt() dialog has nowhere to mount it,
 * so the interaction became a click-to-expand form, with real Turnstile wired in afterwards.
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
  const [status, setStatus] = useState<"idle" | "verifying" | "error" | "voted" | "already">("idle");
  const { copy } = useLanguage();
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
      const result = (await res.json()) as { alreadyVoted?: boolean };

      setOpen(false);
      setEmail("");
      setStatus(result.alreadyVoted ? "already" : "voted");
      onVoted?.();
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary" disabled={status === "voted" || status === "already"}>
        {status === "voted" ? copy.voted : status === "already" ? copy.alreadyVoted : `▲ ${copy.vote}`}
      </button>
    );
  }

  return (
    <div className="card vote-panel w-64 flex flex-col gap-2 p-3 sm:w-72">
      <input
        type="email"
        required
        aria-label={copy.yourEmail}
        placeholder={copy.yourEmail}
        aria-describedby={`vote-email-help-${feedbackId}`}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input"
      />
      <p id={`vote-email-help-${feedbackId}`} className="text-xs text-slate-500 dark:text-slate-400">{copy.voteEmailHelp}</p>
      <div ref={turnstileContainerRef} />
      {status === "error" && <p className="alert-error">{copy.voteFailed}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={status === "verifying" || !email}
          onClick={() => void handleVote()}
          className="btn-primary flex-1"
        >
          {status === "verifying" ? copy.voteSending : copy.confirmVote}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          {copy.cancel}
        </button>
      </div>
    </div>
  );
}
