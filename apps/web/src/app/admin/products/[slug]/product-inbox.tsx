"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FeedbackInbox } from "../../feedback-inbox";
import { useLanguage } from "@/components/language-provider";

interface ProductStat {
  id: string;
  slug: string;
  name: string;
  brandColor: string | null;
}

export function ProductInbox({ slug }: { slug: string }) {
  const { copy } = useLanguage();
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
    <main className="shell-wide page-enter">
      <Link href="/admin" className="link text-sm">
        {copy.backToProducts}
      </Link>

      <div className="mt-5 flex items-center gap-3">
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white"
          style={{ background: product?.brandColor ?? "#94a3b8" }}
        />
        <h1 className="text-3xl">{product?.name ?? slug}</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{slug}</p>

      <div className="mt-6">
        <FeedbackInbox productSlug={slug} />
      </div>
    </main>
  );
}
