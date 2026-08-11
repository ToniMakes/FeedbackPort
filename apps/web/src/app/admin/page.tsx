"use client";

import { FEEDBACK_STATUSES } from "@feedbackport/core";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { statusLabel } from "@/lib/status";

interface FeedbackItem {
  id: string;
  title: string;
  body: string | null;
  status: string;
  submitter_email: string;
  created_at: string;
}

/**
 * 跨产品统一收件箱，见 docs/ARCHITECTURE.md「跨产品统一收件箱」。
 * productFilter 留空 = 默认视图，聚合所有产品的反馈。
 */
export default function AdminInboxPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (productFilter) params.set("product", productFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/admin/feedback?${params.toString()}`);
    const data = await res.json();
    setItems(res.ok ? (data.items ?? []) : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productFilter, statusFilter]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  async function submitReply(id: string, body: string) {
    if (!body.trim()) return;
    await fetch(`/api/admin/feedback/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    void load();
  }

  return (
    <main className="shell-wide">
      <h1>跨产品收件箱</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">默认聚合所有产品的反馈，无需逐个登录切换。</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          placeholder="按 product slug 筛选（留空 = 全部产品）"
          value={productFilter}
          onChange={(event) => setProductFilter(event.target.value)}
          className="input sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="select sm:w-auto"
        >
          <option value="">全部状态</option>
          {FEEDBACK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <p className="card mt-6 text-center text-sm text-slate-500 dark:text-slate-400">没有匹配的反馈。</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((item) => (
            <FeedbackRow key={item.id} item={item} onStatusChange={updateStatus} onReply={submitReply} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FeedbackRow({
  item,
  onStatusChange,
  onReply,
}: {
  item: FeedbackItem;
  onStatusChange: (id: string, status: string) => void;
  onReply: (id: string, body: string) => void;
}) {
  const [replyBody, setReplyBody] = useState("");

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.submitter_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          <select
            value={item.status}
            onChange={(event) => onStatusChange(item.id, event.target.value)}
            className="select w-auto py-1.5 text-xs"
          >
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {item.body && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.body}</p>}

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <textarea
          value={replyBody}
          onChange={(event) => setReplyBody(event.target.value)}
          placeholder="写回复…"
          className="textarea min-h-16 flex-1"
        />
        <button
          type="button"
          onClick={() => {
            onReply(item.id, replyBody);
            setReplyBody("");
          }}
          className="btn-primary self-end"
        >
          回复
        </button>
      </div>
    </li>
  );
}
