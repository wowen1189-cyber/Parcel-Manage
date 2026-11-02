import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * True when this visitor has used a public form too often (default: 10 times an hour). The address is only
 * kept as a hash, and old rows are cleared as we go.
 */
export async function rateLimited(form: string, max = 10, windowMinutes = 60): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const key = createHash("sha256").update(`${form}:${ip}`).digest("hex");
  const db = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await db.from("rate_hit").select("key", { count: "exact", head: true }).eq("key", key).gte("at", since);
  if ((count ?? 0) >= max) return true;
  await db.from("rate_hit").insert({ key });
  if (Math.random() < 0.05) await db.from("rate_hit").delete().lt("at", new Date(Date.now() - 86_400_000).toISOString());
  return false;
}
