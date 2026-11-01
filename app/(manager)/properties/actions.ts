"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contactName, type NamedContact } from "@/lib/format";
import { personName } from "@/lib/import/appfolio";
import { MAX_OWNERS } from "@/lib/property-form";
import { requireCompany } from "@/lib/session";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT_ROLES = ["admin", "property_manager"];
const NOT_ALLOWED = "Only an admin or property manager can change properties.";

// Optional text. A field the form hides (e.g. last name for a business) arrives as undefined.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

function typed(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

export async function updateProperty(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };

  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(2, "Enter the property name.").max(120),
      property_type: z.enum(["single_family", "multi_family", "commercial", "mixed_use"]),
      address_line1: text(150),
      address_line2: text(150),
      city: text(80),
      state: text(2),
      postal_code: text(10),
      county: text(60),
      year_built: z
        .string()
        .trim()
        .transform((v) => (v ? Number(v) : null))
        .refine((v) => v == null || (Number.isInteger(v) && v >= 1800 && v <= 2100), "Enter a 4-digit year built."),
      entity_id: z.string(),
      new_entity_name: text(150),
      notes: text(4000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { id, new_entity_name, entity_id, ...fields } = parsed.data;

  // Ownership splits: rows of name + percent; blank rows are ignored.
  const owners: { name: string; pct: number }[] = [];
  for (let i = 0; i < MAX_OWNERS; i++) {
    const name = String(form.get(`owner_name_${i}`) ?? "").trim();
    const pctRaw = String(form.get(`owner_pct_${i}`) ?? "").trim();
    if (!name && !pctRaw) continue;
    const pct = Number(pctRaw);
    if (!name) return { error: `Enter a name for owner ${i + 1}.`, values: typed(form) };
    if (!(pct > 0 && pct <= 100)) return { error: `Enter ${name}'s ownership as a percent between 0 and 100.`, values: typed(form) };
    owners.push({ name, pct });
  }
  const total = owners.reduce((s, o) => s + o.pct, 0);
  if (owners.length && Math.abs(total - 100) > 0.001) {
    return { error: `Ownership adds up to ${Number(total.toFixed(3))}%. It must total 100%.`, values: typed(form) };
  }
  if (new Set(owners.map((o) => o.name.toLowerCase())).size !== owners.length) return { error: "Each owner can only be listed once.", values: typed(form) };

  let entityId = entity_id;
  if (entity_id === "new") {
    if (!new_entity_name) return { error: "Enter the new LLC's name.", values: typed(form) };
    const { data, error } = await supabase.from("entity").insert({ company_id: company.id, name: new_entity_name, entity_type: "LLC" }).select("id").single();
    if (error) return { error: error.message, values: typed(form) };
    entityId = data.id;
  }

  const { error } = await supabase
    .from("property")
    .update({ ...fields, entity_id: entityId, kind: fields.property_type === "commercial" ? "commercial" : fields.property_type === "mixed_use" ? "mixed" : "residential" })
    .eq("id", id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };

  // Replace the ownership rows. Owners are contacts; reuse one with the same name.
  const { data: contacts } = await supabase.from("contact").select("id, kind, first_name, last_name, business_name").eq("company_id", company.id);
  const byName = new Map((contacts ?? []).map((c) => [contactName(c as NamedContact).toLowerCase(), c.id]));
  const rows = [];
  for (const o of owners) {
    let contactId = byName.get(o.name.toLowerCase());
    if (!contactId) {
      const business = /\b(llc|inc|corp|trust|lp|ltd|company)\b/i.test(o.name);
      const { data, error: cErr } = await supabase
        .from("contact")
        .insert({ company_id: company.id, ...(business ? { kind: "business", business_name: o.name } : { kind: "person", ...personName(o.name) }) })
        .select("id")
        .single();
      if (cErr) return { error: cErr.message, values: typed(form) };
      contactId = data.id;
    }
    rows.push({ company_id: company.id, property_id: id, owner_contact_id: contactId, ownership_pct: o.pct });
  }
  const del = await supabase.from("property_owner").delete().eq("property_id", id).eq("company_id", company.id);
  if (del.error) return { error: del.error.message, values: typed(form) };
  if (rows.length) {
    const ins = await supabase.from("property_owner").insert(rows);
    if (ins.error) return { error: ins.error.message, values: typed(form) };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  return { message: "Saved." };
}
