import { createProductSchema } from "@feedbackport/core";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

interface FeedbackAggregateRow {
  product_id: string;
  status: string;
  title: string;
  created_at: string;
}

/**
 * GET /api/admin/products: feeds the product overview cards (see the admin home redesign:
 * product-first navigation, pick a product, then open its feedback list).
 * One query for products and one for feedback (product_id, status, title, created_at),
 * aggregated in memory by product_id into total / pending / latest, so there isn't one query per product.
 */
export async function GET() {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const supabase = getSupabaseAdmin();

  const [{ data: products, error: productsError }, { data: feedbackRows, error: feedbackError }] =
    await Promise.all([
      supabase.from("products").select("id, slug, name, brand_color, created_at").order("name"),
      supabase
        .from("feedback")
        .select("product_id, status, title, created_at")
        .is("duplicate_of", null)
        .order("created_at", { ascending: false }),
    ]);

  if (productsError || feedbackError) {
    return NextResponse.json({ error: "failed to list products" }, { status: 500 });
  }

  const statsByProduct = new Map<
    string,
    { total: number; open: number; latest: { title: string; createdAt: string } | null }
  >();

  for (const row of (feedbackRows ?? []) as FeedbackAggregateRow[]) {
    const stat = statsByProduct.get(row.product_id) ?? { total: 0, open: 0, latest: null };
    stat.total += 1;
    if (row.status === "open") stat.open += 1;
    // feedbackRows is already sorted by created_at desc, so the first time a product_id appears is its latest item
    if (!stat.latest) stat.latest = { title: row.title, createdAt: row.created_at };
    statsByProduct.set(row.product_id, stat);
  }

  const items = (products ?? []).map((product) => {
    const stat = statsByProduct.get(product.id) ?? { total: 0, open: 0, latest: null };
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brandColor: product.brand_color,
      totalCount: stat.total,
      openCount: stat.open,
      latestFeedback: stat.latest,
    };
  });

  return NextResponse.json({ items });
}

/** POST /api/admin/products: create a product; see "Prerequisite: register the product first" in docs/INTEGRATION.md */
export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin();
  if (!user) return response;

  const body = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      brand_color: parsed.data.brandColor ?? null,
    })
    .select("id, slug, name, brand_color, created_at")
    .single();

  if (error) {
    // 23505 = unique_violation, the slug already exists
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "failed to create product" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
