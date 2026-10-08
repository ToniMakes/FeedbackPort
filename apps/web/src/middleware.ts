import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * 1. 从子域名解析租户 slug，注入 x-tenant-slug 请求头供下游 API Routes / Server Components 使用。
 *    这里只做字符串解析，不查库——product_id 的解析与缓存放在 API 层做
 *    （TODO，见 docs/ARCHITECTURE.md「多租户路由设计」），避免每个请求（含静态资源）
 *    都触发一次数据库查询。
 * 2. 顺带刷新 Supabase Auth 的 session cookie——管理后台的登录态依赖这一步，
 *    Server Component 里的 cookies() 是只读的，写不回浏览器，必须在 middleware 做。
 *    见 https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const slug = extractTenantSlug(hostname) ?? process.env.DEFAULT_TENANT_SLUG ?? null;

  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 没配 Supabase 环境变量时静默跳过，不影响纯租户路由的本地开发
  const isHealthCheck = request.nextUrl.pathname === "/api/health";
  const isCorsPreflight = request.method === "OPTIONS";
  if (supabaseUrl && supabaseAnonKey && !isHealthCheck && !isCorsPreflight) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    await supabase.auth.getUser();
  }

  return response;
}

/** 形如 cardwhisper.board.域名.com -> "cardwhisper"；本地开发用 DEFAULT_TENANT_SLUG 兜底 */
function extractTenantSlug(hostname: string): string | null {
  const [first, second] = hostname.split(".");
  if (!first || second !== "board") return null;
  if (first === "www") return null;
  return first;
}
