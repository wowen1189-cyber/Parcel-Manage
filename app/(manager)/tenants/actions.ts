"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/lib/session";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT_ROLES = ["admin", "property_manager", "leasing_agent"];
const NOT_ALLOWED = "Your role can't change tenant records.";

// Optional text. A field the form hides (e.g. last name for a business) arrives as undefined.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number.")
  .transform((v) => v || null);

function typed(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

/** Name, email and phone numbers for one person or business on a lease. */
export async function updateTenantContact(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({
      contact_id: z.string().uuid(),
      lease_id: z.string().uuid(),
      kind: z.enum(["person", "business"]),
      first_name: text(80),
      last_name: text(80),
      business_name: text(150),
      email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]).transform((v) => v || null),
      mobile: phone,
      phone,
      preferred_contact: z.enum(["", "text", "email", "call"]).transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { contact_id, lease_id, kind, ...fields } = parsed.data;
  if (kind === "person" && !fields.first_name && !fields.last_name) return { error: "Enter a name.", values: typed(form) };
  if (kind === "business" && !fields.business_name) return { error: "Enter the business name.", values: typed(form) };
  if (fields.preferred_contact === "text" && !fields.mobile) return { error: "Add a mobile number to prefer texts.", values: typed(form) };

  const { error } = await supabase
    .from("contact")
    .update(kind === "person" ? { ...fields, business_name: null } : { ...fields, first_name: null, last_name: null })
    .eq("id", contact_id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/tenants/${lease_id}`);
  revalidatePath("/tenants");
  return { message: "Saved." };
}

/** Office notes on the lease and the unit's door code (staff only, never shown in portals). */
export async function updateLeaseNotes(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({ lease_id: z.string().uuid(), unit_id: z.string().uuid(), notes: text(4000), access_notes: text(500) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { lease_id, unit_id, notes, access_notes } = parsed.data;

  const [lease, unit] = await Promise.all([
    supabase.from("lease").update({ notes }).eq("id", lease_id).eq("company_id", company.id),
    supabase.from("unit").update({ access_notes }).eq("id", unit_id).eq("company_id", company.id),
  ]);
  const error = lease.error ?? unit.error;
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/tenants/${lease_id}`);
  return { message: "Saved." };
}
