import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client bound to the current request's cookies, used by Server Components / Route Handlers
 * to read the admin login state. It is not the service-role client in supabase-admin.ts:
 * this one is subject to RLS and only represents the currently signed-in user, so it can't bypass permissions.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // cookies() is read-only in Server Components, so writing throws; that's fine,
          // the session refresh already happens in middleware.ts, so ignore it silently here
        }
      },
    },
  });
}
