import "server-only";
import { headers } from "next/headers";

// The address this request came in on, e.g. https://simreipm.parcelmanage.com
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Only allow redirects to a path on this site (never to another domain).
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}
