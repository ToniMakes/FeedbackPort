"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { VoteButton } from "../vote-button";
import { useLanguage } from "@/components/language-provider";

interface Reply {
  id: string;
  body: string;
  is_admin: boolean;
  created_at: string;
}

interface FeedbackDetail {
  id: string;
  title: string;
  body: string | null;
  status: string;
  created_at: string;
  replies: Reply[];
}

export function BoardDetail({ feedbackId, productSlug }: { feedbackId: string; productSlug: string }) {
  const [item, setItem] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { copy } = useLanguage();

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/feedback/${feedbackId}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItem(data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackId]);

  if (loading) return <p className="shell py-8 text-center text-sm text-slate-400">{copy.loading}</p>;
  if (notFound || !item)
    return <p className="shell py-8 text-center text-sm text-slate-500 dark:text-slate-400">{copy.feedbackNotFound}</p>;

  return (
    <main className="shell page-enter">
      <Link href="/board" className="link text-sm">
        {copy.backToBoard}
      </Link>

      <article className="mt-5 border-y border-slate-200 py-6 sm:py-8">
        <h1 className="text-3xl leading-tight">{item.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <StatusBadge status={item.status} />
        </div>
        {item.body && <p className="mt-5 whitespace-pre-wrap leading-7 text-slate-700">{item.body}</p>}
        <div className="mt-4">
          <VoteButton productSlug={productSlug} feedbackId={item.id} />
        </div>
      </article>

      <h2 className="mt-8 mb-3">{copy.replies}</h2>
      {item.replies.length === 0 ? (
        <p className="card text-sm text-slate-500 dark:text-slate-400">{copy.noReplies}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 border-y border-slate-200">
          {item.replies.map((reply) => (
            <li
              key={reply.id}
              className={
                reply.is_admin
                  ? "py-5"
                  : "py-5"
              }
            >
              {reply.is_admin && (
                  <span className="badge mb-2 bg-indigo-50 text-indigo-700">
                  {copy.teamReply}
                </span>
              )}
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{reply.body}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
