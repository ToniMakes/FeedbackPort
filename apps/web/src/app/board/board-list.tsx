"use client";

import { FEEDBACK_STATUSES } from "@feedbackport/core";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getTurnstileToken } from "@/lib/turnstile-client";
import { StatusBadge } from "@/components/status-badge";
import { statusLabel } from "@/lib/status";
import { VoteButton } from "./vote-button";

interface FeedbackListItem {
  id: string;
  title: string;
  body: string | null;
  status: string;
  submitter_email: string;
  created_at: string;
  votes: { count: number }[];
}

export function BoardList({ productSlug }: { productSlug: string }) {
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/feedback?${params.toString()}`);
    const data = await res.json();
    setItems(res.ok ? (data.items ?? []) : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <main className="shell page-enter">
      <header className="mb-6">
        <p className="eyebrow mb-2">{productSlug}</p>
        <h1 className="text-3xl">Feedback board</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Have an idea? Share it and vote for the features you care about.</p>
      </header>

      <SubmitForm productSlug={productSlug} onSubmitted={load} />

      <div className="mt-10 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base">Ideas</h2>
          <p className="mt-1 text-sm text-slate-500">Vote for the feedback that matters most to you.</p>
        </div>
        <select
          className="select w-auto"
          aria-label="Filter feedback by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          {FEEDBACK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="card py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No feedback yet. Be the first to share an idea.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.id} className="feedback-row">
              <div className="min-w-0">
                <Link href={`/board/${item.id}`} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                  {item.title}
                </Link>
                {item.body && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{item.body}</p>
                )}
                <div className="mt-2">
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-sm font-medium text-slate-500">
                  {item.votes?.[0]?.count ?? 0} votes
                </span>
                <VoteButton productSlug={productSlug} feedbackId={item.id} onVoted={load} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function SubmitForm({ productSlug, onSubmitted }: { productSlug: string; onSubmitted: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) {
      setError("Turnstile is not configured (NEXT_PUBLIC_TURNSTILE_SITE_KEY), so feedback cannot be submitted.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const turnstileToken = await getTurnstileToken(turnstileContainerRef.current, TURNSTILE_SITE_KEY);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          title,
          body: body || undefined,
          submitterEmail: email,
          turnstileToken,
        }),
      });

      if (!res.ok) throw new Error("submit failed");

      setTitle("");
      setBody("");
      onSubmitted();
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
      <h2>Share an idea</h2>
      <input
        required
        maxLength={120}
        aria-label="Summarize your idea"
        placeholder="Summarize your idea"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="input"
      />
      <textarea
        maxLength={2000}
        aria-label="More details (optional)"
        placeholder="More details (optional)"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="textarea"
      />
      <input
        required
        type="email"
        aria-label="Your email"
        placeholder="Your email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input"
      />
      <div ref={turnstileContainerRef} />
      {error && <p className="alert-error">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary self-start">
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
