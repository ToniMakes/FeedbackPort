"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";

interface Draft {
  id: string;
  feedback_id: string;
  body: string;
  rationale: string | null;
  contains_links: boolean;
  created_at: string;
  feedback: {
    title: string;
    body: string | null;
    products: { slug: string; name: string } | null;
  } | null;
}

/**
 * Human review step for AI-drafted replies (see docs/MCP.md). Drafts live in `reply_drafts`; only
 * the publish button below writes a real reply, which is what triggers the notification email.
 * Every string from a draft or from the original feedback is rendered as plain text.
 */
export default function AdminDraftsPage() {
  const { copy } = useLanguage();
  const [items, setItems] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/drafts?status=pending");
    const data = await res.json().catch(() => ({}));
    setItems(res.ok ? (data.items ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "publish" | "reject") {
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/admin/drafts/${id}/${action}`, { method: "POST" });
    if (res.status === 409) setMessage(copy.draftGone);
    else if (!res.ok) setMessage(copy.draftFailed);
    setBusyId(null);
    await load();
  }

  return (
    <main className="shell-wide page-enter">
      <Link href="/admin" className="link text-sm">
        {copy.backToProducts}
      </Link>
      <p className="eyebrow mt-5 mb-2">{copy.workspace}</p>
      <h1 className="text-3xl">{copy.draftsTitle}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.draftsHelper}</p>

      {message && (
        <p role="status" className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          {message}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">{copy.loading}</p>
      ) : items.length === 0 ? (
        <p className="mt-8 border-y border-slate-200 py-10 text-center text-sm text-slate-500">{copy.noDrafts}</p>
      ) : (
        <ul className="mt-6 flex flex-col">
          {items.map((draft) => (
            <li key={draft.id} className="admin-feedback-row">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {copy.draftOriginal}
                {draft.feedback?.products ? ` · ${draft.feedback.products.name}` : ""}
              </p>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{draft.feedback?.title}</p>
              {draft.feedback?.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {draft.feedback.body}
                </p>
              )}

              <p className="mt-5 text-xs uppercase tracking-wide text-slate-500">{copy.draftProposed}</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-slate-200 p-3 text-sm leading-6 dark:border-slate-700">
                {draft.body}
              </p>

              {draft.rationale && (
                <p className="mt-3 text-xs text-slate-500">
                  <span className="font-medium">{copy.draftRationale}:</span> {draft.rationale}
                </p>
              )}
              {draft.contains_links && (
                <p role="alert" className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-400">
                  {copy.draftLinksWarning}
                </p>
              )}

              <p className="mt-4 text-xs text-slate-500">{copy.draftWillEmail}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === draft.id}
                  onClick={() => void act(draft.id, "publish")}
                >
                  {busyId === draft.id ? copy.draftPublishing : copy.draftPublish}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busyId === draft.id}
                  onClick={() => void act(draft.id, "reject")}
                >
                  {copy.draftReject}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
