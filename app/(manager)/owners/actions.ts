"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { feeFromForm } from "@/lib/management-fees";
import { UNASSIGNED_OWNER } from "@/lib/owners";
import { requireCompany } from "@/lib/session";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT_ROLES = ["admin", "property_manager"];
const NOT_ALLOWED = "Only an admin or property manager can change owners.";

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

const ownerSchema = z.object({
  name: z.string().trim().min(2, "Enter the owner's name, like 100 North Dewey St LLC.").max(150),
  entity_type: z.enum(["LLC", "Corporation", "Trust", "Partnership", "Individual"]),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]).transform((v) => v || null),
  phone: text(30),
  mailing_address: text(300),
  notes: text(4000),
});

function revalidateOwners(id?: string) {
  revalidatePath("/owners");
  revalidatePath("/properties");
  if (id) revalidatePath(`/owners/${id}`);
}

export async function createOwner(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = ownerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { data: same } = await supabase.from("entity").select("id").eq("company_id", company.id).ilike("name", parsed.data.name).limit(1);
  if (same?.length) return { error: "An owner with that name already exists. Open it from the owner list instead.", values: typed(form) };
  const { data, error } = await supabase.from("entity").insert({ ...parsed.data, company_id: company.id }).select("id").single();
  if (error) return { error: error.message, values: typed(form) };
  revalidateOwners();
  redirect(`/owners/${data.id}?added=1`);
}

export async function updateOwner(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Owner not found." };
  const parsed = ownerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const { error } = await supabase.from("entity").update(parsed.data).eq("id", id.data).eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidateOwners(id.data);
  return { message: "Saved." };
}

/** Put properties under this owner. A property has one owner, so this moves it from its old one. */
export async function moveProperties(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("entity_id"));
  if (!id.success) return { error: "Owner not found." };
  const ids = form.getAll("property_id").map(String).filter((v) => z.string().uuid().safeParse(v).success);
  if (!ids.length) return { error: "Check at least one property." };
  const { data: owner } = await supabase.from("entity").select("id").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!owner) return { error: "Owner not found." };
  const { error, count } = await supabase.from("property").update({ entity_id: owner.id }, { count: "exact" }).in("id", ids).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidateOwners(owner.id);
  for (const p of ids) revalidatePath(`/properties/${p}`);
  return { message: `${count ?? ids.length} ${count === 1 ? "property" : "properties"} now under this owner.` };
}

/** Delete an owner with no properties (e.g. one added by mistake). */
export async function deleteOwner(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Owner not found." };
  const { count } = await supabase.from("property").select("id", { count: "exact", head: true }).eq("entity_id", id.data).eq("company_id", company.id);
  if (count) return { error: "Move this owner's properties to another owner first." };
  const { error } = await supabase.from("entity").delete().eq("id", id.data).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidateOwners();
  redirect("/owners?deleted=1");
}

/**
 * Save a management fee. scope: "company" (the default every owner starts with; admins only),
 * "owner" (the owner's agreement, used by all of its properties) or "property" (one property).
 * mode "inherit" clears an owner's or property's own fee so it follows the level above.
 */
export async function saveFee(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  const scope = String(form.get("scope"));
  const inherit = form.get("mode") === "inherit";
  if (scope === "company" ? membership.role !== "admin" : !EDIT_ROLES.includes(membership.role)) {
    return { error: scope === "company" ? "Only an admin can change the company default fee." : NOT_ALLOWED };
  }
  let fee = null;
  if (!inherit) {
    const result = feeFromForm(Object.fromEntries(form));
    if (!result.fee) return { error: result.error, values: typed(form) };
    fee = result.fee;
  }

  if (scope === "company") {
    const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings) ? company.settings : {};
    const { error } = await supabase.from("company").update({ settings: { ...settings, managementFee: fee } }).eq("id", company.id);
    if (error) return { error: error.message, values: typed(form) };
    revalidateOwners();
    return { message: "Company default saved. Owners without their own agreement use it." };
  }

  const id = z.string().uuid().safeParse(form.get("target_id"));
  if (!id.success) return { error: "Not found." };
  if (scope === "owner") {
    const { data: owner } = await supabase.from("entity").select("name").eq("id", id.data).eq("company_id", company.id).maybeSingle();
    if (!owner) return { error: "Owner not found." };
    if (owner.name === UNASSIGNED_OWNER && !inherit) return { error: "Move these properties to their real owner first, then set the fee there." };
    const { error } = await supabase.from("entity").update({ management_fee: fee ?? {} }).eq("id", id.data).eq("company_id", company.id);
    if (error) return { error: error.message, values: typed(form) };
    revalidateOwners(id.data);
    return { message: inherit ? "This owner now uses the company default." : "Saved. Every property this owner has uses this fee unless a property has its own." };
  }
  if (scope === "property") {
    const { data, error } = await supabase.from("property").update({ management_fee: fee }).eq("id", id.data).eq("company_id", company.id).select("entity_id").maybeSingle();
    if (error) return { error: error.message, values: typed(form) };
    if (!data) return { error: "Property not found." };
    revalidatePath(`/properties/${id.data}`);
    revalidateOwners(data.entity_id);
    return { message: inherit ? "This property now uses its owner's fee." : "Saved. This property uses its own fee." };
  }
  return { error: "Not found." };
}
