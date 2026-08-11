import { ProductInbox } from "./product-inbox";

export default async function AdminProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductInbox slug={slug} />;
}
