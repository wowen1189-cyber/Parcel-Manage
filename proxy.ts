import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROOT_DOMAIN, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { authCookieOptions } from "@/lib/supabase/cookie-options";
import { subdomainFromHost } from "@/lib/tenant";

// Runs before every page: keeps the Supabase session fresh and tells the app which
// company's subdomain the visitor is on (x-company-subdomain header).
export async function proxy(request: NextRequest) {
  const subdomain = subdomainFromHost(request.headers.get("host"), ROOT_DOMAIN);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-company-subdomain");
  if (subdomain) requestHeaders.set("x-company-subdomain", subdomain);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: authCookieOptions(request.headers.get("host")),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Refreshes an expiring session token. Don't put code between createServerClient and this call.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
