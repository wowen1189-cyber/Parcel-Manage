import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerKey, hashApiKey, type ApiScope } from "./keys";

// Every API and MCP request: a valid, unrevoked key (its company is the only data it can reach) and at most
// 120 requests a minute per key.

export type ApiCaller = { companyId: string; keyId: string; scopes: ApiScope[] };

export const apiError = (status: number, message: string) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

export async function apiCaller(request: Request): Promise<ApiCaller | NextResponse> {
  const key = bearerKey(request.headers.get("authorization"));
  if (!key) return apiError(401, "Send your API key as: Authorization: Bearer pm_…");
  const db = createAdminClient();
  const { data: k } = await db.from("api_key").select("id, company_id, scopes, revoked_at, last_used_at").eq("key_hash", hashApiKey(key)).maybeSingle();
  if (!k || k.revoked_at) return apiError(401, "This API key isn't valid or was revoked.");
  const rateKey = createHash("sha256").update(`api:${k.id}`).digest("hex");
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("rate_hit").select("key", { count: "exact", head: true }).eq("key", rateKey).gte("at", since);
  if ((count ?? 0) >= 120) return apiError(429, "Too many requests: 120 a minute per key. Wait a minute and try again.");
  await db.from("rate_hit").insert({ key: rateKey });
  // Note use at most once a minute, so busy keys don't write on every call.
  if (!k.last_used_at || Date.parse(k.last_used_at) < Date.now() - 60_000) await db.from("api_key").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
  return { companyId: k.company_id, keyId: k.id, scopes: k.scopes as ApiScope[] };
}
