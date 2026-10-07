import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health —— 负载均衡器 / 冒烟测试用的存活检查。
 * 只说明进程能处理请求，刻意不查数据库，也不返回任何内部信息：
 * 依赖服务（Supabase 等）抖动不应该让容器被判死并反复重启。
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
