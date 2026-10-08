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
      setError(res.status === 409 ? "That slug is already in use." : (data?.error ?? "Could not create product."));
      return;
    }

    router.push("/admin");
  }

  return (
    <main className="shell page-enter max-w-lg">
      <p className="eyebrow mb-2">Workspace</p>
      <h1 className="text-3xl">Add a product</h1>
      <p className="mt-2 text-sm text-slate-500">Create a dedicated feedback board for a product.</p>
      <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="product-slug">
            Product slug
          </label>
          <input
            id="product-slug"
            required
            placeholder="e.g. cardwhisper"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-slate-500">Used in the public board URL. Use lowercase letters, numbers, and hyphens.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="product-name">
            Product name
          </label>
          <input
            id="product-name"
            required
            placeholder="Product name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="product-color">
            Brand color
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
          {submitting ? "Creating…" : "Create product"}
        </button>
      </form>
    </main>
  );
}
