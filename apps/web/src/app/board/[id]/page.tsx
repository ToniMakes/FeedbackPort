import { headers } from "next/headers";
import { BoardDetail } from "./board-detail";

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerList = await headers();
  const productSlug = headerList.get("x-tenant-slug");

  if (!productSlug) {
    return (
      <p className="shell alert-error">未能识别产品——检查访问域名的子域名，或本地开发时的 DEFAULT_TENANT_SLUG 配置。</p>
    );
  }

  return <BoardDetail feedbackId={id} productSlug={productSlug} />;
}
