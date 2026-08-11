import { headers } from "next/headers";
import { BoardList } from "./board-list";

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
    return (
      <p className="shell alert-error">未能识别产品——检查访问域名的子域名，或本地开发时的 DEFAULT_TENANT_SLUG 配置。</p>
    );
  }

  return <BoardList productSlug={productSlug} />;
}
