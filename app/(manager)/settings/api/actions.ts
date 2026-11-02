"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { API_SCOPES, newApiKey, type ApiScope } from "@/lib/api/keys";
import { isAdmin, requireCompany } from "@/lib/session";

export type KeyState = { error?: string; key?: string; name?: string };

/** Make a key. The full key is returned this once and never stored. */
export async function createApiKey(_: KeyState, form: FormData): Promise<KeyState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!isAdmin(membership)) return { error: "Only admins can make API keys." };
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) return { error: "Name the key after what uses it, like Zapier or QuickBooks sync." };
  const scopes = (Object.keys(API_SCOPES) as ApiScope[]).filter((s) => form.get(`scope_${s}`) === "on");
  if (!scopes.length) return { error: "Choose what the key may do." };
  const { key, hash, prefix } = newApiKey();
  const { error } = await supabase.from("api_key").insert({ company_id: company.id, name: name.data, prefix, key_hash: hash, scopes, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/settings/api");
  return { key, name: name.data };
}

export async function revokeApiKey(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await supabase.from("api_key").update({ revoked_at: new Date().toISOString() }).eq("id", id.data).eq("company_id", company.id).is("revoked_at", null);
  revalidatePath("/settings/api");
}
