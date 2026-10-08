import type { Product } from "@feedbackport/core";
import { getSupabaseAdmin } from "./supabase-admin";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand_color: string | null;
  created_at: string;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandColor: row.brand_color,
    createdAt: row.created_at,
  };
}

const CACHE_TTL_MS = 60_000;
const productCache = new Map<string, { product: Product; expiresAt: number }>();

/**
 * Look up a product by slug. Hits are cached in memory for 60 seconds per server instance,
 * so a busy board doesn't re-query `products` on every request. Misses are never cached, so a
 * newly registered product is visible immediately; edits to a cached product can take up to
 * a minute to show up on other instances (see docs/ARCHITECTURE.md, "Multi-tenant routing design").
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const cached = productCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.product;

  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("id, slug, name, brand_color, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const product = toProduct(data as ProductRow);
  productCache.set(slug, { product, expiresAt: Date.now() + CACHE_TTL_MS });
  return product;
}
