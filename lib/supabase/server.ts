import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { authCookieOptions } from "./cookie-options";
import type { Database } from "./database.types";

// Supabase client acting as the signed-in user. Row Level Security applies to everything it does.
export async function createClient() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: authCookieOptions(headerStore.get("host")),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
