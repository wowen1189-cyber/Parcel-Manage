"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inviteSummary, sendInvites } from "@/lib/portal-invites";
import { requireCompany } from "@/lib/session";

// Bulk portal invites (Tenants › Portal invites, Owners › Portal invites). Nothing is sent until a person
// presses Send on the list they checked.

export type BulkInviteState = { error?: string; message?: string };

const TENANT_ROLES = ["admin", "property_manager", "leasing_agent", "maintenance_coordinator", "accountant"];
const OWNER_ROLES = ["admin", "property_manager", "accountant"];

export async function sendBulkInvites(_: BulkInviteState, form: FormData): Promise<BulkInviteState> {
  const { supabase, company, membership } = await requireCompany();
  const keys = z.array(z.string().regex(/^[tep]:[0-9a-f-]{36}$/)).max(500).safeParse(form.getAll("invitee"));
  if (!keys.success || !keys.data.length) return { error: "Check at least one person." };
  const owners = keys.data.some((k) => !k.startsWith("t:"));
  const tenants = keys.data.some((k) => k.startsWith("t:"));
  if ((tenants && !TENANT_ROLES.includes(membership.role)) || (owners && !OWNER_ROLES.includes(membership.role))) return { error: "Your role can't send portal invites." };
  if (!company.subdomain) return { error: "The company has no web address yet." };
  const r = await sendInvites(supabase, company, keys.data);
  revalidatePath(owners ? "/owners" : "/tenants", "layout");
  return inviteSummary(r);
}
