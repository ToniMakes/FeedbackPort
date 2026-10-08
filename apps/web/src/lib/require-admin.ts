import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "./supabase-server";

/**
 * Login-state check for admin API Routes. There is no role system: the project has a single admin account
 * (created by hand in the Supabase project; the login page's signInWithOtp uses shouldCreateUser: false
 * to block self-service sign-up), and an existing session counts as admin.
 *
 * Usage: `const { user, response } = await requireAdmin(); if (!user) return response;`
 */
export async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  return { user, response: null };
}
