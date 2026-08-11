"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { VoteButton } from "../vote-button";

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
  submitter_email: string;
  created_at: string;
  replies: Reply[];
}

export function BoardDetail({ feedbackId, productSlug }: { feedbackId: string; productSlug: string }) {
  const [item, setItem] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  if (loading) return <p className="shell py-8 text-center text-sm text-slate-400">加载中…</p>;
  if (notFound || !item)
    return <p className="shell py-8 text-center text-sm text-slate-500 dark:text-slate-400">没找到这条反馈。</p>;

  return (
    <main className="shell">
      <Link href="/board" className="link text-sm">
        ← 返回列表
      </Link>

      <div className="card mt-4">
        <h1>{item.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <StatusBadge status={item.status} />
          <span>提交者：{item.submitter_email}</span>
        </div>
        {item.body && <p className="mt-4 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{item.body}</p>}
        <div className="mt-4">
          <VoteButton productSlug={productSlug} feedbackId={item.id} />
        </div>
      </div>

      <h2 className="mt-8 mb-3">回复</h2>
      {item.replies.length === 0 ? (
        <p className="card text-sm text-slate-500 dark:text-slate-400">还没有回复。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {item.replies.map((reply) => (
            <li
              key={reply.id}
              className={
                reply.is_admin
                  ? "card border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/30"
                  : "card"
              }
            >
              {reply.is_admin && (
                <span className="badge mb-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                  官方回复
                </span>
              )}
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{reply.body}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
