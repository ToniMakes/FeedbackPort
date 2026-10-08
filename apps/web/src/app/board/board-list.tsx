"use client";

import { FEEDBACK_STATUSES } from "@feedbackport/core";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getTurnstileToken } from "@/lib/turnstile-client";
import { StatusBadge } from "@/components/status-badge";
import { statusLabel } from "@/lib/status";
import { VoteButton } from "./vote-button";
import { useLanguage } from "@/components/language-provider";

interface FeedbackListItem {
  id: string;
  title: string;
  body: string | null;
  status: string;
  created_at: string;
  votes: { count: number }[];
}

export function BoardList({ productSlug }: { productSlug: string }) {
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "votes">("newest");
  const { locale, copy } = useLanguage();

  const visibleItems = items
    .filter((item) => `${item.title} ${item.body ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === "votes"
      ? (b.votes?.[0]?.count ?? 0) - (a.votes?.[0]?.count ?? 0) || Date.parse(b.created_at) - Date.parse(a.created_at)
      : Date.parse(b.created_at) - Date.parse(a.created_at));

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
        <h1 className="text-3xl">{copy.boardTitle} {productSlug}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.boardIntro}</p>
        <a href="#share-idea" className="btn-primary mt-4 inline-flex">{copy.shareIdea}</a>
      </header>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base">{copy.browseIdeas}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            aria-label={copy.searchIdeas}
            placeholder={copy.searchIdeas}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input w-full sm:w-48"
          />
          <select className="select w-auto" aria-label={copy.sortBy} value={sort} onChange={(event) => setSort(event.target.value as "newest" | "votes")}>
            <option value="newest">{copy.newest}</option>
            <option value="votes">{copy.mostVotes}</option>
          </select>
          <select
            className="select w-auto"
            aria-label={copy.filterStatus}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">{copy.allStatuses}</option>
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">{copy.loading}</p>
      ) : visibleItems.length === 0 ? (
        <p className="card py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {items.length === 0 && !search && !statusFilter ? copy.noIdeas : copy.noIdeasMatch}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibleItems.map((item) => (
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

      <div id="share-idea" className="mt-10 scroll-mt-6">
        <SubmitForm productSlug={productSlug} onSubmitted={load} />
      </div>
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
  const [success, setSuccess] = useState(false);
  const { copy } = useLanguage();
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) {
      setError(copy.turnstileMissing);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

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
      setSuccess(true);
      void onSubmitted();
    } catch {
      setError(copy.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
      <h2>{copy.shareIdea}</h2>
      <input
        required
        maxLength={120}
        aria-label={copy.ideaTitle}
        placeholder={copy.ideaTitle}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="input"
      />
      <textarea
        maxLength={2000}
        aria-label={copy.ideaDetails}
        placeholder={copy.ideaDetails}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="textarea"
      />
      <input
        required
        type="email"
        aria-label={copy.yourEmail}
        placeholder={copy.yourEmail}
        aria-describedby="submit-email-help"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input"
      />
      <p id="submit-email-help" className="-mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.submitEmailHelp}</p>
      <div ref={turnstileContainerRef} />
      {error && <p className="alert-error">{error}</p>}
      {success && <p className="alert-success" role="status">{copy.ideaShared}</p>}
      <button type="submit" disabled={submitting} className="btn-primary self-start">
        {submitting ? copy.submitting : copy.submitIdea}
      </button>
    </form>
  );
}
