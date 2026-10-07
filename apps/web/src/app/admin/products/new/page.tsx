"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewProductPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name, brandColor }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(res.status === 409 ? "这个 slug 已经被用过了" : (data?.error ?? "创建失败"));
      return;
    }

    router.push("/admin");
  }

  return (
    <main className="shell page-enter max-w-lg">
      <p className="eyebrow mb-2">Workspace</p>
      <h1 className="text-3xl">新增产品</h1>
      <p className="mt-2 text-sm text-slate-500">为一个产品创建独立的反馈入口。</p>
      <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="product-slug">
            产品标识（Slug）
          </label>
          <input
            id="product-slug"
            required
            placeholder="如 cardwhisper，只能小写字母数字连字符"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-slate-500">用于公开反馈面板地址，只能使用小写字母、数字和连字符。</p>
        </div>
        <div>
          <label className="field-label" htmlFor="product-name">
            产品名称
          </label>
          <input
            id="product-name"
            required
            placeholder="产品名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="product-color">
            品牌色
          </label>
          <div className="flex items-center gap-3">
            <input
              id="product-color"
              type="color"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">{brandColor}</span>
          </div>
        </div>
        {error && <p className="alert-error">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary self-start">
          {submitting ? "创建中…" : "创建"}
        </button>
      </form>
    </main>
  );
}
