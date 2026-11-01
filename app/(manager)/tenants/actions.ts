"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { COMMERCIAL_TERM_MONTHS, commercialTermsFromForm, readCommercialTerms, type CommercialTerms } from "@/lib/commercial-terms";
import { readBusinessRules } from "@/lib/business-rules";
import { todayIn } from "@/lib/format";
import { leaseEndDate } from "@/lib/lease-expirations";
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

// ---------- automatic billing settings ----------

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[$,\s]/g, ""))
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), `Enter ${label} as a dollar amount, like 75 or 75.00.`)
    .transform((v) => (v ? Math.round(Number(v) * 100) : null));
const optionalDate = z
  .string()
  .trim()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date.")
  .transform((v) => v || null);

/**
 * What the system bills automatically for one tenancy: the late fee policy, returned-payment fee and payment
 * rules. "company" clears the custom policy so the company's business rules apply. This never edits the lease
 * document. Fla. Stat. ch. 83 Part II sets no late-fee amount, but a fee is only collectible if the signed lease
 * provides for it (83.43 lets the lease designate it as rent), so the policy should not exceed the lease.
 */
export async function updateBillingSettings(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const parsed = z
    .object({
      lease_id: z.string().uuid(),
      late_fee_source: z.enum(["company", "lease"]),
      late_fee_type: z.enum(["flat", "pct_rent", "pct_all"]),
      late_fee_grace_days: z.string().trim(),
      late_fee_amount: z.string().trim(),
      late_fee_daily: money("the daily fee"),
      late_fee_daily_max: money("the daily fee limit"),
      nsf_fee: money("the returned payment fee"),
      certified_funds_only: z.literal("on").optional(),
      rent_reminders: z.literal("on").optional(),
      next_rent_increase_on: optionalDate,
      next_rent: money("the new rent"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;

  let lateFee = {
    late_fee_grace_days: null as number | null,
    late_fee_flat_cents: null as number | null,
    late_fee_pct: null as number | null,
    late_fee_basis: null as string | null,
    late_fee_daily_cents: null as number | null,
    late_fee_daily_max_cents: null as number | null,
  };
  if (d.late_fee_source === "lease") {
    const grace = Number(d.late_fee_grace_days);
    if (!Number.isInteger(grace) || grace < 0 || grace > 28) return { error: "Enter the grace period as whole days (0 to 28).", values: typed(form) };
    const amount = Number(d.late_fee_amount.replace(/[$,%\s]/g, ""));
    if (!(amount > 0)) return { error: "Enter the late fee amount.", values: typed(form) };
    const pct = d.late_fee_type !== "flat";
    if (pct && amount > 100) return { error: "A percent late fee can't be over 100%.", values: typed(form) };
    if (d.late_fee_daily_max != null && !d.late_fee_daily) return { error: "Add the daily fee, or clear the daily fee limit.", values: typed(form) };
    lateFee = {
      late_fee_grace_days: grace,
      late_fee_flat_cents: pct ? null : Math.round(amount * 100),
      late_fee_pct: pct ? amount : null,
      late_fee_basis: d.late_fee_type === "pct_all" ? "all_charges" : "rent",
      late_fee_daily_cents: d.late_fee_daily || null,
      late_fee_daily_max_cents: d.late_fee_daily ? d.late_fee_daily_max : null,
    };
  }
  if ((d.next_rent_increase_on == null) !== (d.next_rent == null)) return { error: "Enter both the date and the new rent for the next increase, or neither.", values: typed(form) };

  const { error } = await supabase
    .from("lease")
    .update({
      ...lateFee,
      nsf_fee_cents: d.nsf_fee,
      certified_funds_only: Boolean(d.certified_funds_only),
      rent_reminders: Boolean(d.rent_reminders),
      next_rent_increase_on: d.next_rent_increase_on,
      next_rent_cents: d.next_rent,
    })
    .eq("id", d.lease_id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/tenants/${d.lease_id}`);
  return { message: "Saved." };
}

// ---------- household: renters insurance, vehicles, pets, emergency contacts ----------

const HOUSEHOLD = ["renters_insurance", "vehicle", "pet", "emergency_contact"] as const;
type HouseholdTable = (typeof HOUSEHOLD)[number];

/** Adds or updates one household record. `id` empty = add. */
export async function saveHouseholdItem(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const base = z
    .object({ table: z.enum(HOUSEHOLD), id: z.string(), lease_id: z.string().uuid() })
    .safeParse(Object.fromEntries(form));
  if (!base.success) return { error: "Something went wrong. Reload the page and try again." };
  const { table, id, lease_id } = base.data;
  const person = z.string().uuid("Choose who this belongs to.");

  let row: Record<string, unknown>;
  const raw = Object.fromEntries(form);
  if (table === "renters_insurance") {
    const p = z
      .object({
        tenant_contact_id: person,
        carrier: z.string().trim().min(1, "Enter the insurance company.").max(120),
        policy_number: text(80),
        expires_on: optionalDate,
        liability: money("the liability coverage"),
        company_is_interested_party: z.literal("on").optional(),
      })
      .safeParse(raw);
    if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
    const today = new Date().toISOString().slice(0, 10);
    row = {
      tenant_contact_id: p.data.tenant_contact_id,
      carrier: p.data.carrier,
      policy_number: p.data.policy_number,
      expires_on: p.data.expires_on,
      liability_cents: p.data.liability,
      company_is_interested_party: Boolean(p.data.company_is_interested_party),
      status: p.data.expires_on && p.data.expires_on < today ? "expired" : "active",
    };
  } else if (table === "vehicle") {
    const p = z
      .object({ tenant_contact_id: person, make_model: text(80), color: text(40), tag_number: text(12), tag_state: text(2), parking_permit_number: text(40) })
      .safeParse(raw);
    if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
    if (!p.data.make_model && !p.data.tag_number) return { error: "Enter the make and model or the plate number.", values: typed(form) };
    row = { ...p.data, tag_number: p.data.tag_number?.toUpperCase().replace(/\s+/g, "") ?? null, tag_state: p.data.tag_state?.toUpperCase() ?? null };
  } else if (table === "pet") {
    const p = z
      .object({
        kind: z.string().trim().min(1, "Enter the kind of animal, like Cat or Labrador.").max(60),
        name: text(60),
        weight_lbs: z
          .string()
          .trim()
          .refine((v) => !v || (Number(v) > 0 && Number(v) < 400), "Enter the weight in pounds.")
          .transform((v) => (v ? Number(v) : null)),
        is_assistance_animal: z.literal("on").optional(),
        notes: text(500),
      })
      .safeParse(raw);
    if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
    row = { ...p.data, is_assistance_animal: Boolean(p.data.is_assistance_animal) };
  } else {
    const p = z
      .object({
        tenant_contact_id: person,
        name: z.string().trim().min(1, "Enter the emergency contact's name.").max(120),
        relationship: text(60),
        phone: z
          .string()
          .trim()
          .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number."),
      })
      .safeParse(raw);
    if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
    row = p.data;
  }

  // The person must be on this lease (and so in this company).
  if (typeof row.tenant_contact_id === "string") {
    const { data: onLease } = await supabase.from("lease_tenant").select("contact_id").eq("lease_id", lease_id).eq("contact_id", row.tenant_contact_id).eq("company_id", company.id).maybeSingle();
    if (!onLease) return { error: "That person isn't on this lease.", values: typed(form) };
  }
  const withLease = table === "emergency_contact" ? row : { ...row, lease_id };
  const write = id
    ? supabase.from(table as HouseholdTable).update({ ...withLease, updated_source: "office" } as never).eq("id", id).eq("company_id", company.id)
    : supabase.from(table as HouseholdTable).insert({ ...withLease, company_id: company.id, updated_source: "office" } as never);
  const { error } = await write;
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/tenants/${lease_id}`);
  return { message: id ? "Saved." : "Added." };
}

export async function deleteHouseholdItem(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return;
  const p = z.object({ table: z.enum(HOUSEHOLD), id: z.string().uuid(), lease_id: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await supabase.from(p.data.table).delete().eq("id", p.data.id).eq("company_id", company.id);
  revalidatePath(`/tenants/${p.data.lease_id}`);
}

// ---------- new lease ----------

const personRow = z.object({
  role: z.enum(["tenant", "guarantor", "occupant"]),
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email for everyone on the lease.")]),
  mobile: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter 10-digit phone numbers."),
});

/**
 * New lease on a unit: people (tenants, co-signers, occupants), start date, length, rent and deposit.
 * The end date always comes from the length (last day of the month). Under the short-term length the
 * surcharge is added to rent; over 12 months the yearly increase is scheduled, as the lease states.
 */
export async function createLease(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const rules = readBusinessRules(company.settings);
  const parsed = z
    .object({
      unit_id: z.string().uuid("Choose the unit."),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the start date."),
      months: z.coerce.number().int("Choose the lease length.").min(1, "Choose the lease length."),
      rent: money("the monthly rent"),
      deposit: money("the deposit"),
      status: z.enum(["draft", "active"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const d = parsed.data;
  if (!d.rent) return { error: "Enter the monthly rent.", values: typed(form) };

  const people: z.infer<typeof personRow>[] = [];
  for (let i = 0; i < 6; i++) {
    const row = {
      role: String(form.get(`p${i}_role`) ?? "tenant"),
      first_name: String(form.get(`p${i}_first_name`) ?? ""),
      last_name: String(form.get(`p${i}_last_name`) ?? ""),
      email: String(form.get(`p${i}_email`) ?? ""),
      mobile: String(form.get(`p${i}_mobile`) ?? ""),
    };
    if (!row.first_name.trim() && !row.last_name.trim()) continue;
    const p = personRow.safeParse(row);
    if (!p.success) return { error: p.error.issues[0].message, values: typed(form) };
    people.push(p.data);
  }
  if (!people.some((p) => p.role === "tenant")) return { error: "Add at least one tenant.", values: typed(form) };
  if (!people[0].email && !people[0].mobile) return { error: "Add an email or mobile for the first tenant.", values: typed(form) };

  const { data: unit } = await supabase.from("unit").select("id, kind, status, lease(id, status)").eq("id", d.unit_id).eq("company_id", company.id).maybeSingle();
  if (!unit) return { error: "That unit wasn't found.", values: typed(form) };
  // Commercial space (Fla. Stat. ch. 83 Part I) has its own lengths and terms; residential rules don't apply.
  const commercial = unit.kind === "commercial";
  let terms: CommercialTerms | null = null;
  if (commercial) {
    if (d.months < COMMERCIAL_TERM_MONTHS.min || d.months > COMMERCIAL_TERM_MONTHS.max) return { error: `Commercial leases can be ${COMMERCIAL_TERM_MONTHS.min} to ${COMMERCIAL_TERM_MONTHS.max} months.`, values: typed(form) };
    const t = commercialTermsFromForm(Object.fromEntries(form));
    if (!t.terms) return { error: t.error, values: typed(form) };
    if (!t.terms.permittedUse) return { error: "Enter the permitted use, like \"Hair and nail salon\".", values: typed(form) };
    terms = t.terms;
  } else if (d.months < rules.lease.minTermMonths || d.months > rules.lease.maxTermMonths) {
    return { error: `Leases are ${rules.lease.minTermMonths} to ${rules.lease.maxTermMonths} months.`, values: typed(form) };
  }
  if (unit.lease.some((l) => l.status === "active") && d.status === "active")
    return { error: "This unit already has an active lease. Save this one as a draft, or end the current lease first.", values: typed(form) };

  const end = leaseEndDate(d.start_date, d.months);
  const surcharge = !commercial && d.months < rules.lease.shortTermUnderMonths ? rules.lease.shortTermSurchargeCents : 0;
  const increase = terms ? terms.annualIncreasePercent : rules.lease.longTermYearlyIncreasePercent;
  const anniversary = (() => {
    const [y, m, day] = d.start_date.split("-").map(Number);
    return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  })();
  const { data: lease, error } = await supabase
    .from("lease")
    .insert({
      company_id: company.id,
      unit_id: d.unit_id,
      start_date: d.start_date,
      end_date: end,
      term_months: d.months,
      rent_cents: d.rent + surcharge,
      short_term_surcharge_cents: surcharge,
      deposit_cents: d.deposit ?? 0,
      status: d.status,
      move_in_on: d.status === "active" ? d.start_date : null,
      next_rent_increase_on: d.months > 12 && increase > 0 ? anniversary : null,
      next_rent_cents: d.months > 12 && increase > 0 ? Math.round(((d.rent + surcharge) * (100 + increase)) / 100) : null,
      commercial_terms: terms,
    })
    .select("id")
    .single();
  if (error) return { error: error.message, values: typed(form) };

  let primaryDone = false;
  for (const p of people) {
    const { data: c, error: cErr } = await supabase
      .from("contact")
      .insert({ company_id: company.id, kind: "person", first_name: p.first_name || null, last_name: p.last_name || null, email: p.email || null, mobile: p.mobile || null })
      .select("id")
      .single();
    if (cErr) return { error: cErr.message, values: typed(form) };
    const isPrimary = !primaryDone && p.role === "tenant";
    if (isPrimary) primaryDone = true;
    const { error: ltErr } = await supabase.from("lease_tenant").insert({ company_id: company.id, lease_id: lease.id, contact_id: c.id, role: p.role, is_primary: isPrimary });
    if (ltErr) return { error: ltErr.message, values: typed(form) };
  }
  if (d.status === "active" && d.start_date <= todayIn(company.time_zone)) {
    await supabase.from("unit").update({ status: "occupied" }).eq("id", d.unit_id).eq("company_id", company.id);
  }
  revalidatePath("/tenants");
  redirect(`/tenants/${lease.id}?added=1`);
}

/** A draft lease was signed: it becomes active and the unit occupied once the lease has started. */
export async function markLeaseSigned(form: FormData): Promise<void> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return;
  const id = z.string().uuid().safeParse(form.get("lease_id"));
  if (!id.success) return;
  const { data: lease } = await supabase.from("lease").select("id, unit_id, start_date, status, unit(lease(id, status))").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!lease || lease.status !== "draft") return;
  // Another active lease on the unit (the current tenant on notice is fine) blocks activation.
  if (lease.unit.lease.some((l) => l.id !== lease.id && l.status === "active")) redirect(`/tenants/${lease.id}?blocked=1`);
  await supabase.from("lease").update({ status: "active", move_in_on: lease.start_date }).eq("id", lease.id).eq("company_id", company.id);
  if (lease.start_date <= todayIn(company.time_zone)) {
    await supabase.from("unit").update({ status: "occupied" }).eq("id", lease.unit_id).eq("company_id", company.id);
  }
  revalidatePath(`/tenants/${lease.id}`);
  revalidatePath("/tenants");
}

/** Commercial lease terms (use, yearly increase, renewal option, CAM, utilities, repairs) on one lease. */
export async function saveCommercialTerms(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, company, membership } = await requireCompany();
  if (!EDIT_ROLES.includes(membership.role)) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("lease_id"));
  if (!id.success) return { error: "Lease not found." };
  const { data: lease } = await supabase.from("lease").select("id, rent_cents, start_date, term_months, commercial_terms, unit(kind)").eq("id", id.data).eq("company_id", company.id).maybeSingle();
  if (!lease || lease.unit.kind !== "commercial") return { error: "Lease not found." };
  const t = commercialTermsFromForm(Object.fromEntries(form), readCommercialTerms(lease.commercial_terms));
  if (!t.terms) return { error: t.error, values: typed(form) };
  if (!t.terms.permittedUse) return { error: "Enter the permitted use, like \"Hair and nail salon\".", values: typed(form) };
  const increase = t.terms.annualIncreasePercent;
  const [y, m, day] = lease.start_date.split("-").map(Number);
  const long = (lease.term_months ?? 0) > 12 && increase > 0;
  const { error } = await supabase
    .from("lease")
    .update({
      commercial_terms: t.terms,
      next_rent_increase_on: long ? `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null,
      next_rent_cents: long ? Math.round((lease.rent_cents * (100 + increase)) / 100) : null,
    })
    .eq("id", lease.id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath(`/tenants/${lease.id}`);
  revalidatePath(`/tenants/${lease.id}/lease`);
  return { message: "Saved. The lease below is updated." };
}
