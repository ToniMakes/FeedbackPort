import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * 1. Resolve the tenant slug from the subdomain and inject it as the x-tenant-slug header for downstream
 *    API Routes / Server Components. This is string parsing only, with no database lookup; resolving
 *    product_id happens in the API layer (see lib/tenant.ts and docs/ARCHITECTURE.md, "Multi-tenant routing design"),
 *    so that not every request (static assets included) triggers a database query.
 * 2. Also refresh the Supabase Auth session cookie. The admin login state depends on this: cookies() in
 *    Server Components is read-only and can't write back to the browser, so it has to happen in middleware.
 *    See https://supabase.com/docs/guides/auth/server-side/nextjs
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

  // Skip silently when the Supabase env vars aren't set, so tenant-only local development still works
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

/** e.g. cardwhisper.board.example.com -> "cardwhisper"; local development falls back to DEFAULT_TENANT_SLUG */
function extractTenantSlug(hostname: string): string | null {
  const [first, second] = hostname.split(".");
  if (!first || second !== "board") return null;
  if (first === "www") return null;
  return first;
}
