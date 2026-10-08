"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";

interface ProductStat {
  id: string;
  slug: string;
  name: string;
  brandColor: string | null;
  totalCount: number;
  openCount: number;
  latestFeedback: { title: string; createdAt: string } | null;
}

/**
 * Admin home: product-first navigation. Pick a product first, then open its feedback.
 * The cross-product unified inbox (the core differentiator in docs/ARCHITECTURE.md) isn't lost:
 * it moved to /admin/all, reachable from the link at the top right, and the "see everything at a glance" idea
 * is now carried by the pending count on each product card instead of one big default list.
 */
export default function AdminProductsPage() {
  const { copy } = useLanguage();
  const [items, setItems] = useState<ProductStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/products")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="shell-wide page-enter">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">{copy.workspace}</p>
          <h1 className="text-3xl">{copy.products}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.productsHelper}</p>
        </div>
        <Link href="/admin/all" className="link shrink-0 text-sm">
          {copy.allFeedback} →
        </Link>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">{copy.loading}</p>
      ) : items.length === 0 ? (
        <div className="card mt-6 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{copy.noProducts}</p>
          <Link href="/admin/products/new" className="btn-primary mt-4 inline-flex">
            + {copy.addProduct}
          </Link>
        </div>
      ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProductCard({ product }: { product: ProductStat }) {
  const { copy } = useLanguage();
  return (
    <Link
      href={`/admin/products/${product.slug}`}
      className="card block !rounded-lg !p-4 transition-colors hover:!border-indigo-300 sm:!p-5"
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: product.brandColor ?? "#94a3b8" }}
        />
        <p className="font-medium text-slate-900">{product.name}</p>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{product.slug}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {product.openCount > 0 && (
          <span className="badge bg-indigo-50 text-indigo-700">
            {product.openCount} {copy.openCount}
          </span>
        )}
        <span className="text-xs text-slate-400">{product.totalCount} {copy.totalCount}</span>
      </div>

      {product.latestFeedback && (
        <p className="mt-3 truncate border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {copy.latest} {product.latestFeedback.title}
        </p>
      )}
    </Link>
  );
}
