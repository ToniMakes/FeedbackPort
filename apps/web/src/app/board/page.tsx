import { headers } from "next/headers";
import { BoardList } from "./board-list";
import { resolveLocale } from "@/lib/ui-copy";

/**
 * Public board entry point; see the board URL notes next to "Widget init parameters" in docs/API.md.
 * The tenant slug is resolved from the subdomain by middleware.ts and written to x-tenant-slug; this page only reads it,
 * with no database lookup. Interaction lives in a Client Component (board-list.tsx), so the Server Component
 * does just one thing: tenant resolution.
 */
export default async function BoardPage() {
  const headerList = await headers();
  const productSlug = headerList.get("x-tenant-slug");

  if (!productSlug) {
    const message = resolveLocale(headerList.get("accept-language")) === "zh"
      ? "这个面板尚未关联产品，请打开为你的产品配置的面板网址。"
      : "This board isn’t linked to a product. Open the board URL configured for your product.";
    return (
      <p className="shell alert-error">{message}</p>
    );
  }

  return <BoardList productSlug={productSlug} />;
}
