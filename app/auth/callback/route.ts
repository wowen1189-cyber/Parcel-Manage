import { NextResponse, type NextRequest } from "next/server";
import { getOrigin, safeNext } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";

// Where emailed links land (sign-in link, email confirmation, password reset).
// Emails carry a token_hash, which works in any browser or device. We don't use it here:
// some email systems open every link to scan it, which would use up the one-time token.
// Instead we send the person to /continue, where they tap a button to finish.
// `code` links (from OAuth or older emails) only work in the browser that started the sign-in.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const origin = await getOrigin(); // keeps the company subdomain (nextUrl.origin can drop it locally)

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type) {
    const target = new URL("/continue", origin);
    target.search = new URLSearchParams({ token_hash: tokenHash, type, next }).toString();
    return NextResponse.redirect(target);
  }

  const code = url.searchParams.get("code");
  const ok = code ? !(await (await createClient()).auth.exchangeCodeForSession(code)).error : false;
  return NextResponse.redirect(new URL(ok ? next : "/sign-in?link=expired", origin));
}
