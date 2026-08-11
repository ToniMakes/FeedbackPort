"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FeedbackInbox } from "../../feedback-inbox";

interface ProductStat {
  id: string;
  slug: string;
  name: string;
  brandColor: string | null;
}

export function ProductInbox({ slug }: { slug: string }) {
  const [product, setProduct] = useState<ProductStat | null>(null);

  useEffect(() => {
    fetch("/api/admin/products")
      .then((res) => res.json())
      .then((data) => {
        const items: ProductStat[] = data.items ?? [];
        setProduct(items.find((item) => item.slug === slug) ?? null);
      });
  }, [slug]);

  return (
    <main className="shell-wide">
      <Link href="/admin" className="link text-sm">
        ← 返回产品列表
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: product?.brandColor ?? "#94a3b8" }}
        />
        <h1>{product?.name ?? slug}</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{slug}</p>

      <div className="mt-6">
        <FeedbackInbox productSlug={slug} />
      </div>
    </main>
  );
}
