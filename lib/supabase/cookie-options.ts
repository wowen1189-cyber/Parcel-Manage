import type { CookieOptionsWithName } from "@supabase/ssr";
import { ROOT_DOMAIN } from "@/lib/env";

// On parcelmanage.com and its company subdomains, the sign-in cookie is shared by all of them,
// so creating a company on the main site carries the session over to its new address.
// Anywhere else (localhost, Vercel preview addresses) the cookie stays on the exact host,
// because a browser rejects a cookie for a domain the page isn't on.
export function authCookieOptions(host: string | null | undefined): CookieOptionsWithName | undefined {
  const root = ROOT_DOMAIN.split(":")[0].toLowerCase();
  const h = (host ?? "").split(":")[0].toLowerCase();
  if (root === "localhost" || !(h === root || h.endsWith(`.${root}`))) return undefined;
  return { domain: `.${root}`, path: "/", sameSite: "lax", secure: true };
}
