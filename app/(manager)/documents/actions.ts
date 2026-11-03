"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/lib/session";

// Share a document with the tenant (resident portal) or the owner (owner portal), or take it back.
// Changes are audited by the document table's trigger.

const ROLES = ["admin", "property_manager", "accountant", "leasing_agent"];

export async function setDocumentSharing(input: { id: string; who: "tenant" | "owner"; shared: boolean; path: string }): Promise<{ error?: string }> {
  const { supabase, company, membership } = await requireCompany();
  if (!ROLES.includes(membership.role)) return { error: "Your role can't change who sees documents." };
  const p = z.object({ id: z.string().uuid(), who: z.enum(["tenant", "owner"]), shared: z.boolean(), path: z.string().startsWith("/") }).safeParse(input);
  if (!p.success) return { error: "Document not found." };
  const change = p.data.who === "tenant" ? { office_only: !p.data.shared } : { shared_with_owner: p.data.shared };
  const { data, error } = await supabase.from("document").update(change).eq("id", p.data.id).eq("company_id", company.id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Document not found." };
  revalidatePath(p.data.path);
  return {};
}
