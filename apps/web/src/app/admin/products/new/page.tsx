"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/components/language-provider";

export default function NewProductPage() {
  const { copy } = useLanguage();
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
      setError(res.status === 409 ? copy.slugExists : copy.createFailed);
      return;
    }

    router.push("/admin");
  }

  return (
    <main className="shell page-enter max-w-lg">
      <p className="eyebrow mb-2">{copy.workspace}</p>
      <h1 className="text-3xl">{copy.addProductTitle}</h1>
      <p className="mt-2 text-sm text-slate-500">{copy.addProductHelper}</p>
      <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="product-slug">
            {copy.boardUrlSlug}
          </label>
          <input
            id="product-slug"
            required
            placeholder={copy.slugPlaceholder}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-slate-500">{copy.slugHelper}</p>
        </div>
        <div>
          <label className="field-label" htmlFor="product-name">
            {copy.productName}
          </label>
          <input
            id="product-name"
            required
            placeholder={copy.productName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="product-color">
            {copy.brandColor}
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
          {submitting ? copy.creating : copy.createProduct}
        </button>
      </form>
    </main>
  );
}
