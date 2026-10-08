import { headers } from "next/headers";
import { BoardDetail } from "./board-detail";

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerList = await headers();
  const productSlug = headerList.get("x-tenant-slug");

  if (!productSlug) {
    return (
      <p className="shell alert-error">No product was identified for this board. Open the board URL configured for your product, or set DEFAULT_TENANT_SLUG for local development.</p>
    );
  }

  return <BoardDetail feedbackId={id} productSlug={productSlug} />;
}
