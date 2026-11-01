"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin, requireCompany } from "@/lib/session";
import { VENDOR_TRADES } from "@/lib/vendors";

export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const EDIT_ROLES = ["admin", "property_manager", "maintenance_coordinator", "accountant"];

// Optional text. A field the form hides (e.g. last name for a business) arrives as undefined.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const day = z
  .string()
  .trim()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date.")
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

export async function updateVendor(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: "Your role can't change vendors." };

  const parsed = z
    .object({
      id: z.string().uuid(),
      contact_id: z.string().uuid(),
      kind: z.enum(["person", "business"]),
      business_name: text(150),
      first_name: text(80),
      last_name: text(80),
      email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]).transform((v) => v || null),
      phone,
      mobile: phone,
      address_line1: text(150),
      address_line2: text(150),
      city: text(80),
      state: text(2),
      postal_code: text(10),
      contact_notes: text(2000),
      trade: z.enum(VENDOR_TRADES as [string, ...string[]]),
      payment_method: z.enum(["", "ach", "check", "mailed_check", "card", "other"]).transform((v) => v || null),
      is_1099: z.literal("on").optional(),
      w9_on_file: z.literal("on").optional(),
      w9_received_on: day,
      coi_expires_on: day,
      workers_comp_expires_on: day,
      auto_insurance_expires_on: day,
      license_expires_on: day,
      epa_cert_expires_on: day,
      contract_expires_on: day,
      dispatch_override: z.literal("on").optional(),
      notes: text(4000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;
  if (d.kind === "business" && !d.business_name) return { error: "Enter the company name.", values: typed(form) };
  if (d.kind === "person" && !d.first_name && !d.last_name) return { error: "Enter the vendor's name.", values: typed(form) };

  // Only an admin may let a vendor be dispatched without paperwork; keep the current setting otherwise.
  const { data: current } = await supabase.from("vendor").select("dispatch_override").eq("id", d.id).eq("company_id", company.id).single();
  const override = isAdmin(membership) ? Boolean(d.dispatch_override) : Boolean(current?.dispatch_override);

  const [c, v] = await Promise.all([
    supabase
      .from("contact")
      .update({
        kind: d.kind,
        business_name: d.kind === "business" ? d.business_name : null,
        first_name: d.kind === "person" ? d.first_name : null,
        last_name: d.kind === "person" ? d.last_name : null,
        email: d.email,
        phone: d.phone,
        mobile: d.mobile,
        address_line1: d.address_line1,
        address_line2: d.address_line2,
        city: d.city,
        state: d.state,
        postal_code: d.postal_code,
        notes: d.contact_notes,
      })
      .eq("id", d.contact_id)
      .eq("company_id", company.id),
    supabase
      .from("vendor")
      .update({
        trade: d.trade,
        payment_method: d.payment_method,
        is_1099: Boolean(d.is_1099),
        w9_on_file: Boolean(d.w9_on_file),
        w9_received_on: d.w9_received_on,
        coi_expires_on: d.coi_expires_on,
        workers_comp_expires_on: d.workers_comp_expires_on,
        auto_insurance_expires_on: d.auto_insurance_expires_on,
        license_expires_on: d.license_expires_on,
        epa_cert_expires_on: d.epa_cert_expires_on,
        contract_expires_on: d.contract_expires_on,
        dispatch_override: override,
        notes: d.notes,
      })
      .eq("id", d.id)
      .eq("company_id", company.id),
  ]);
  const error = c.error ?? v.error;
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${d.id}`);
  return { message: "Saved." };
}

/** Quick add: name, trade and how to reach them. Paperwork is added on the vendor's page next. */
export async function createVendor(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: "Your role can't add vendors." };
  const parsed = z
    .object({
      kind: z.enum(["person", "business"]),
      business_name: text(150),
      first_name: text(80),
      last_name: text(80),
      contact_person: text(120),
      trade: z.enum(VENDOR_TRADES as [string, ...string[]]),
      email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]).transform((v) => v || null),
      phone,
      mobile: phone,
      payment_method: z.enum(["", "ach", "check", "mailed_check", "card", "other"]).transform((v) => v || null),
      is_1099: z.literal("on").optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;
  if (d.kind === "business" && !d.business_name) return { error: "Enter the company name.", values: typed(form) };
  if (d.kind === "person" && !d.first_name && !d.last_name) return { error: "Enter the vendor's name.", values: typed(form) };
  if (!d.email && !d.phone && !d.mobile) return { error: "Add a phone number or email so you can reach them.", values: typed(form) };

  const { data: contact, error: cErr } = await supabase
    .from("contact")
    .insert({
      company_id: company.id,
      kind: d.kind,
      business_name: d.kind === "business" ? d.business_name : null,
      first_name: d.kind === "person" ? d.first_name : null,
      last_name: d.kind === "person" ? d.last_name : null,
      email: d.email,
      phone: d.phone,
      mobile: d.mobile,
      notes: d.contact_person ? `Contact: ${d.contact_person}` : null,
    })
    .select("id")
    .single();
  if (cErr) return { error: cErr.message, values: typed(form) };
  const { data: vendor, error } = await supabase
    .from("vendor")
    .insert({ company_id: company.id, contact_id: contact.id, trade: d.trade, payment_method: d.payment_method, is_1099: Boolean(d.is_1099) })
    .select("id")
    .single();
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath("/vendors");
  redirect(`/vendors/${vendor.id}?added=1`);
}
