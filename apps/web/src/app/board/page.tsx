import { headers } from "next/headers";
import { BoardList } from "./board-list";
import { resolveLocale } from "@/lib/ui-copy";

/**
 * 公开面板入口，见 docs/API.md「Widget 初始化参数」旁边的公开面板地址说明。
 * 租户 slug 由 middleware.ts 从子域名解析后写进 x-tenant-slug，这里只读不查库，
 * 交互逻辑放进 Client Component（board-list.tsx），保持 Server Component 只做
 * 租户解析这一件事。
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
