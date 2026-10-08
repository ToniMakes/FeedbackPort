import { headers } from "next/headers";
import { BoardDetail } from "./board-detail";
import { resolveLocale } from "@/lib/ui-copy";

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  return <BoardDetail feedbackId={id} productSlug={productSlug} />;
}
