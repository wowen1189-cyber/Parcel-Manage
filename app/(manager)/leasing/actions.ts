"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiComplete } from "@/lib/ai/provider";
import { readBusinessRules } from "@/lib/business-rules";
import { emailHtml, emailText } from "@/lib/email/layout";
import { bedBath, money } from "@/lib/format";
import { stripe } from "@/lib/integrations/stripe/client";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { adverseActionText, inviteMember, unitName } from "@/lib/leasing";
import { DECISION_LABEL, depositFor } from "@/lib/screening";
import { requireCompany } from "@/lib/session";
import { refreshRecommendation } from "@/lib/screening-refresh";
import { placeCheckrOrder, syncCheckrOrder } from "@/lib/checkr-screening";
import { CHECKR_PACKAGES } from "@/lib/integrations/checkr/rules";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeasingState = { error?: string; message?: string; link?: string; draft?: string };

const ROLES = ["admin", "property_manager", "leasing_agent"];
const NOT_ALLOWED = "Your role can't change leasing.";
const dollars = z
  .string()
  .transform((v) => (v.trim() ? Math.round(Number(v.replace(/[$,\s]/g, "")) * 100) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Enter a dollar amount.");

async function staff() {
  const ctx = await requireCompany();
  return { ...ctx, allowed: ROLES.includes(ctx.membership.role) };
}

// ---------- listings ----------

export async function saveListing(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z
    .object({
      unit_id: z.string().uuid(),
      headline: z.string().trim().min(4, "Add a headline, like Bright 2-bedroom near downtown.").max(90),
      description: z.string().trim().max(4000),
      rent: dollars.refine((v) => v !== null && v > 0, "Enter the asking rent."),
      deposit: dollars,
      available_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
      pets_allowed: z.literal("on").optional(),
      amenities: z.string().max(600),
      intent: z.enum(["save", "publish", "unpublish"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { data: unit } = await supabase.from("unit").select("id").eq("id", d.unit_id).eq("company_id", company.id).maybeSingle();
  if (!unit) return { error: "Unit not found." };
  const { data: existing } = await supabase.from("listing").select("status, published_at").eq("unit_id", d.unit_id).maybeSingle();
  const status = d.intent === "publish" ? "published" : d.intent === "unpublish" ? "closed" : (existing?.status ?? "draft");
  const { error } = await supabase.from("listing").upsert(
    {
      company_id: company.id,
      unit_id: d.unit_id,
      headline: d.headline,
      description: d.description,
      rent_cents: d.rent!,
      deposit_cents: d.deposit,
      available_on: d.available_on || null,
      pets_allowed: Boolean(d.pets_allowed),
      amenities: d.amenities
        .split(/[,\n]/)
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 30),
      status,
      published_at: status === "published" ? (existing?.published_at ?? new Date().toISOString()) : existing?.published_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "unit_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/leasing/units/${d.unit_id}`);
  revalidatePath("/leasing");
  return { message: d.intent === "publish" ? "Published on your rentals page." : d.intent === "unpublish" ? "Taken off your rentals page." : "Saved." };
}

/** AI-written description from the unit's facts only. A person edits and saves it. */
export async function writeDescription(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const unitId = String(form.get("unit_id") ?? "");
  const { data: u } = await supabase.from("unit").select("label, beds, baths, sqft, kind, property(name, city, state)").eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (!u) return { error: "Unit not found." };
  const facts = [
    `Unit: ${unitName(u)}, ${u.property.city ?? ""} ${u.property.state ?? ""}`.trim(),
    u.kind === "commercial" ? "Commercial space" : `Home: ${bedBath(u.beds, u.baths)}`,
    u.sqft ? `${u.sqft} square feet` : "",
    `Rent: ${String(form.get("rent") ?? "")}`,
    `Pets: ${form.get("pets_allowed") === "on" ? "allowed with fees, assistance animals always welcome" : "no pets; assistance animals always welcome"}`,
    `Features the manager listed: ${String(form.get("amenities") ?? "") || "none given"}`,
  ]
    .filter(Boolean)
    .join("\n");
  const r = await aiComplete({
    companyId: company.id,
    feature: "listing_description",
    system:
      "You write rental listing descriptions for a Florida property manager. Use only the facts given; never invent features, distances, schools or neighborhood claims. Follow the Fair Housing Act: describe the property, never the ideal tenant (no words about families, children, age, religion, race, national origin, sex, disability, or 'perfect for' a kind of person). 90 to 140 words, plain friendly sentences, no emoji, no headings. End with how to apply online.",
    prompt: facts,
    maxTokens: 400,
  });
  if (!r.ok) return { error: r.reason };
  return { draft: r.text.trim(), message: "Draft written. Read it, edit anything, then save." };
}

export async function startListingPhoto(input: { unitId: string; type: string; size: number }): Promise<{ path?: string; token?: string; error?: string }> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.type)) return { error: "Use JPG, PNG or WebP photos." };
  if (input.size > 10 * 1024 * 1024) return { error: "That photo is too big (10 MB max)." };
  const { data: l } = await supabase.from("listing").select("id").eq("unit_id", input.unitId).eq("company_id", company.id).maybeSingle();
  if (!l) return { error: "Save the listing first, then add photos." };
  const path = `${company.id}/listings/${input.unitId}/${Date.now()}.${input.type.split("/")[1].replace("jpeg", "jpg")}`;
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { error: "The upload couldn't start." };
  return { path, token: data.token };
}

export async function finishListingPhoto(input: { unitId: string; path: string }): Promise<{ error?: string }> {
  const { supabase, company, allowed } = await staff();
  if (!allowed || !input.path.startsWith(`${company.id}/listings/${input.unitId}/`)) return { error: NOT_ALLOWED };
  const { data: l } = await supabase.from("listing").select("photos").eq("unit_id", input.unitId).eq("company_id", company.id).single();
  await supabase.from("listing").update({ photos: [...(l?.photos ?? []), input.path].slice(0, 25) }).eq("unit_id", input.unitId).eq("company_id", company.id);
  revalidatePath(`/leasing/units/${input.unitId}`);
  return {};
}

export async function removeListingPhoto(form: FormData): Promise<void> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return;
  const unitId = String(form.get("unit_id"));
  const path = String(form.get("path"));
  const { data: l } = await supabase.from("listing").select("photos").eq("unit_id", unitId).eq("company_id", company.id).single();
  if (!l) return;
  await supabase.from("listing").update({ photos: l.photos.filter((x) => x !== path) }).eq("unit_id", unitId).eq("company_id", company.id);
  revalidatePath(`/leasing/units/${unitId}`);
}

// ---------- application links ----------

/** A personal application link for a specific unit, pre-filled with the person's name and contact. */
export async function sendApplicationLink(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z
    .object({
      unit_id: z.string().uuid("Choose the unit."),
      guest_card_id: z.string().uuid().optional().or(z.literal("")),
      first_name: z.string().trim().min(1, "Enter their first name.").max(60),
      last_name: z.string().trim().max(60),
      email: z.string().trim().email("Enter a valid e-mail.").or(z.literal("")),
      phone: z.string().trim().max(30),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { data: u } = await supabase.from("unit").select("id, kind, label, market_rent_cents, property(name), listing(rent_cents)").eq("id", d.unit_id).eq("company_id", company.id).maybeSingle();
  if (!u) return { error: "Unit not found." };
  const rent = u.listing?.rent_cents ?? u.market_rent_cents;
  if (!rent) return { error: "Set an asking rent on the listing first." };
  const { data: app, error } = await supabase
    .from("application")
    .insert({ company_id: company.id, unit_id: u.id, kind: u.kind, rent_cents: rent, guest_card_id: d.guest_card_id || null, status: "invited" })
    .select("id")
    .single();
  if (error || !app) return { error: error?.message ?? "Couldn't create the application." };
  const { data: m } = await supabase
    .from("application_member")
    .insert({ company_id: company.id, application_id: app.id, role: "applicant", first_name: d.first_name, last_name: d.last_name, email: d.email || null, phone: d.phone || null })
    .select("id, first_name, email")
    .single();
  if (!m) return { error: "Couldn't add the applicant." };
  const { url, emailed } = await inviteMember(createAdminClient(), company, m, unitName(u), company.name);
  if (d.guest_card_id) await supabase.from("guest_card").update({ status: "applied" }).eq("id", d.guest_card_id).eq("company_id", company.id);
  revalidatePath("/leasing");
  return { message: emailed ? `Application link e-mailed to ${d.email}.` : "Application link ready. Copy it and send it by text.", link: url };
}

// ---------- guest cards and showings ----------

const guestFields = z.object({
  first_name: z.string().trim().min(1, "Enter their first name.").max(60),
  last_name: z.string().trim().max(60),
  email: z.string().trim().email("Enter a valid e-mail.").or(z.literal("")),
  phone: z.string().trim().max(30),
  unit_id: z.string().uuid().or(z.literal("")),
  source: z.string().max(30),
  desired_move_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  notes: z.string().max(2000),
});

export async function createGuestCard(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = guestFields.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!p.data.email && !p.data.phone) return { error: "Add an e-mail or a phone number." };
  const { data, error } = await supabase
    .from("guest_card")
    .insert({ company_id: company.id, ...p.data, email: p.data.email || null, phone: p.data.phone || null, unit_id: p.data.unit_id || null, desired_move_in: p.data.desired_move_in || null })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't save." };
  redirect(`/leasing/guests/${data.id}`);
}

export async function updateGuestCard(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = guestFields.extend({ id: z.string().uuid(), status: z.enum(["new", "contacted", "showing", "applied", "lost"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { id, ...rest } = p.data;
  const { error } = await supabase
    .from("guest_card")
    .update({ ...rest, email: rest.email || null, phone: rest.phone || null, unit_id: rest.unit_id || null, desired_move_in: rest.desired_move_in || null })
    .eq("id", id)
    .eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath(`/leasing/guests/${id}`);
  return { message: "Saved." };
}

export async function scheduleShowing(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z
    .object({ guest_card_id: z.string().uuid(), unit_id: z.string().uuid("Choose the unit."), starts_at: z.string().min(16, "Choose the date and time."), notes: z.string().max(500) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  // datetime-local has no zone: read it in the company's time zone.
  const startsAt = zonedToUtc(p.data.starts_at, company.time_zone);
  const { error } = await supabase.from("showing").insert({ company_id: company.id, guest_card_id: p.data.guest_card_id, unit_id: p.data.unit_id, starts_at: startsAt, notes: p.data.notes });
  if (error) return { error: error.message };
  await supabase.from("guest_card").update({ status: "showing" }).eq("id", p.data.guest_card_id).eq("company_id", company.id).in("status", ["new", "contacted"]);
  revalidatePath(`/leasing/guests/${p.data.guest_card_id}`);
  return { message: "Showing booked." };
}

export async function setShowingStatus(form: FormData): Promise<void> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return;
  const p = z.object({ id: z.string().uuid(), status: z.enum(["done", "no_show", "canceled"]), guest_card_id: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await supabase.from("showing").update({ status: p.data.status }).eq("id", p.data.id).eq("company_id", company.id);
  revalidatePath(`/leasing/guests/${p.data.guest_card_id}`);
}

function zonedToUtc(local: string, timeZone: string): string {
  const guess = new Date(`${local}:00Z`);
  const shown = new Date(guess.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (asUtc.getTime() - shown.getTime())).toISOString();
}

// ---------- screening and decisions ----------

export async function enterScreening(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, user, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z
    .object({
      member_id: z.string().uuid(),
      credit_score: z.string().transform((v) => (v.trim() ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 300 && v <= 900), "Credit scores run 300 to 850."),
      eviction_years_ago: z.string().transform((v) => (v.trim() ? Number(v) : null)).refine((v) => v === null || (v >= 0 && v < 100), "Enter years since the eviction, or leave blank."),
      owes_landlord: z.literal("on").optional(),
      utility_or_car_problems: z.literal("on").optional(),
      criminal_records: z.literal("on").optional(),
      agency_name: z.string().trim().max(120),
      report_ref: z.string().trim().max(80),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { data: m } = await supabase.from("application_member").select("id, application_id").eq("id", d.member_id).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Applicant not found." };
  const { error } = await supabase.from("screening_report").upsert(
    {
      company_id: company.id,
      application_member_id: m.id,
      provider: "manual",
      credit_score: d.credit_score,
      eviction_years_ago: d.eviction_years_ago,
      owes_landlord: Boolean(d.owes_landlord),
      utility_or_car_problems: Boolean(d.utility_or_car_problems),
      criminal_records: Boolean(d.criminal_records),
      agency_name: d.agency_name || null,
      report_ref: d.report_ref || null,
      entered_by: user.id,
      received_at: new Date().toISOString(),
    },
    { onConflict: "application_member_id" },
  );
  if (error) return { error: error.message };
  await refreshRecommendation(supabase, company.id, m.application_id);
  revalidatePath(`/leasing/applications/${m.application_id}`);
  return { message: "Results saved." };
}

/** Recompute the recommendation from every adult's income and report. */
/** Order a Checkr screening for one applicant (Checkr e-mails them to complete it). */
export async function orderCheckrScreening(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, user, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z.object({ member_id: z.string().uuid(), package: z.enum(CHECKR_PACKAGES) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Choose a screening package." };
  const r = await placeCheckrOrder(supabase, company, p.data.member_id, p.data.package, user.id);
  if (!r.ok) return { error: r.error };
  const { data: m } = await supabase.from("application_member").select("application_id").eq("id", p.data.member_id).single();
  if (m) revalidatePath(`/leasing/applications/${m.application_id}`);
  return { message: "Screening ordered. Checkr has e-mailed the applicant to complete it." };
}

/** Ask Checkr for the latest on an order (results also arrive on their own when Checkr's webhook is set up). */
export async function refreshCheckrScreening(orderRowId: string): Promise<void> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return;
  const { data: row } = await supabase.from("screening_order").select("id, application_member(application_id)").eq("id", orderRowId).eq("company_id", company.id).maybeSingle();
  if (!row) return;
  await syncCheckrOrder(supabase, row.id).catch(() => null);
  if (row.application_member?.application_id) revalidatePath(`/leasing/applications/${row.application_member.application_id}`);
}

/**
 * A person's decision. Declines and higher-deposit approvals that rest on a consumer report send the FCRA
 * adverse action notice; a decline refunds the admin fee when the company's rules say so.
 */
export async function decideApplication(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, user, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z
    .object({
      application_id: z.string().uuid(),
      decision: z.enum(["approve", "approve_higher_deposit", "decline"]),
      deposit: dollars,
      note: z.string().trim().max(1000),
      agency_name: z.string().trim().max(120),
      agency_address: z.string().trim().max(200),
      agency_phone: z.string().trim().max(40),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { data: a } = await supabase
    .from("application")
    .select("id, status, rent_cents, fees_paid_cents, payment_ref, admin_fee_refunded_cents, recommendation, unit(label, property(name)), application_member(id, role, first_name, last_name, email, screening_report(credit_score, received_at, agency_name))")
    .eq("id", d.application_id)
    .eq("company_id", company.id)
    .single();
  if (!a) return { error: "Application not found." };
  if (!["new", "screening", "approved"].includes(a.status)) return { error: "This application can't be decided now." };
  const rules = readBusinessRules(company.settings);
  const rec = a.recommendation as { reasons?: string[]; adverseAction?: boolean } | null;
  const usedReport = a.application_member.some((m) => m.screening_report);
  const deposit = d.decision === "decline" ? null : (d.deposit ?? depositFor(a.rent_cents, d.decision === "approve" ? rules.screening.depositMonthsAtOrAboveTier : rules.screening.depositMonthsBelowTierMin));
  const adverse = usedReport && (d.decision === "approve_higher_deposit" || (d.decision === "decline" && rec?.adverseAction !== false));
  if (adverse && (!d.agency_name || !d.agency_address || !d.agency_phone)) return { error: "Enter the screening company's name, address and phone. The adverse action notice must include them (FCRA)." };

  let refunded = 0;
  if (d.decision === "decline" && rules.fees.refundAdminFeeIfDenied && a.fees_paid_cents >= rules.fees.adminFeeCents && !a.admin_fee_refunded_cents) {
    if (a.payment_ref && company.stripe_account_id) {
      try {
        await stripe("POST", "refunds", { payment_intent: a.payment_ref, amount: rules.fees.adminFeeCents, "metadata[reason]": "Admin fee refunded on denial" }, company.stripe_account_id);
        refunded = rules.fees.adminFeeCents;
      } catch (e) {
        return { error: `The admin fee refund didn't go through in Stripe: ${e instanceof Error ? e.message : "error"}. Nothing was changed.` };
      }
    }
  }

  await supabase
    .from("application")
    .update({
      status: d.decision === "decline" ? "declined" : "approved",
      decision: d.decision,
      deposit_cents: deposit,
      decision_note: d.note || null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      admin_fee_refunded_cents: a.admin_fee_refunded_cents + refunded,
      adverse_agency: adverse ? { name: d.agency_name, address: d.agency_address, phone: d.agency_phone } : null,
    })
    .eq("id", a.id)
    .eq("company_id", company.id);

  const unit = unitName(a.unit);
  const adults = a.application_member.filter((m) => m.role !== "guarantor");
  let sent = 0;
  for (const m of adults) {
    if (!m.email) continue;
    const name = `${m.first_name} ${m.last_name}`.trim();
    const paragraphs = adverse
      ? adverseActionText({
          applicant: name,
          company: company.name,
          unit,
          action: d.decision === "decline" ? "decline" : "higher_deposit",
          depositText: deposit ? money(deposit) : undefined,
          agency: { name: d.agency_name, address: d.agency_address, phone: d.agency_phone },
          score: m.screening_report?.credit_score ? { value: m.screening_report.credit_score, date: m.screening_report.received_at.slice(0, 10) } : null,
          reasons: [],
        }).map(escapeHtml)
      : d.decision === "decline"
        ? [`Dear ${escapeHtml(name)},`, `Thank you for applying for ${escapeHtml(unit)}. We're unable to approve your application because it doesn't meet our written rental criteria, which are the same for every applicant.`]
        : [`Dear ${escapeHtml(name)},`, `Good news: your application for ${escapeHtml(unit)} is approved. The security deposit is ${money(deposit)}. We'll send your lease to sign next.`];
    if (refunded) paragraphs.push(`Your ${money(refunded)} admin fee has been refunded to your card.`);
    const content = { preheader: d.decision === "decline" ? "About your rental application." : "About your rental application.", heading: d.decision === "decline" ? "Your rental application" : "Your application is approved", paragraphs, fromLine: company.name };
    if (await sendEmail({ to: m.email, subject: `Your rental application: ${unit}`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email })) sent++;
  }
  if (adverse && sent) await supabase.from("application").update({ adverse_action_sent_at: new Date().toISOString() }).eq("id", a.id);
  revalidatePath(`/leasing/applications/${a.id}`);
  revalidatePath("/leasing");
  return {
    message: `${DECISION_LABEL[d.decision]}: saved. ${sent ? `E-mailed ${sent} applicant${sent === 1 ? "" : "s"}${adverse ? " the adverse action notice" : ""}.` : adverse ? "No e-mail on file: print and mail the adverse action notice." : "No e-mail on file."}${refunded ? ` Refunded the ${money(refunded)} admin fee.` : ""}`,
  };
}

export async function setApplicationStatus(form: FormData): Promise<void> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return;
  const p = z.object({ id: z.string().uuid(), status: z.enum(["lease_sent", "signed", "withdrawn", "new"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await supabase.from("application").update({ status: p.data.status }).eq("id", p.data.id).eq("company_id", company.id);
  revalidatePath(`/leasing/applications/${p.data.id}`);
}

/** Invite another adult (co-applicant or guarantor) to an existing application. */
export async function addMember(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const p = z
    .object({
      application_id: z.string().uuid(),
      role: z.enum(["co_applicant", "guarantor"]),
      first_name: z.string().trim().min(1, "Enter their first name.").max(60),
      last_name: z.string().trim().max(60),
      email: z.string().trim().email("Enter a valid e-mail.").or(z.literal("")),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: a } = await supabase.from("application").select("id, unit(label, property(name))").eq("id", p.data.application_id).eq("company_id", company.id).single();
  if (!a) return { error: "Application not found." };
  const { data: m } = await supabase
    .from("application_member")
    .insert({ company_id: company.id, application_id: a.id, role: p.data.role, first_name: p.data.first_name, last_name: p.data.last_name, email: p.data.email || null })
    .select("id, first_name, email")
    .single();
  if (!m) return { error: "Couldn't add them." };
  const { url, emailed } = await inviteMember(createAdminClient(), company, m, unitName(a.unit), company.name);
  revalidatePath(`/leasing/applications/${a.id}`);
  return { message: emailed ? `Invite e-mailed to ${p.data.email}.` : "Invite link ready to copy.", link: url };
}

/** New link for someone who lost theirs (the old one stops working). */
export async function resendInvite(_: LeasingState, form: FormData): Promise<LeasingState> {
  const { supabase, company, allowed } = await staff();
  if (!allowed) return { error: NOT_ALLOWED };
  const id = z.string().uuid().safeParse(form.get("member_id"));
  if (!id.success) return { error: "Applicant not found." };
  const { data: m } = await supabase.from("application_member").select("id, first_name, email, status, application(id, unit(label, property(name)))").eq("id", id.data).eq("company_id", company.id).single();
  if (!m) return { error: "Applicant not found." };
  const { url, emailed } = await inviteMember(createAdminClient(), company, m, unitName(m.application.unit), company.name);
  return { message: emailed ? `New link e-mailed to ${m.email}.` : "New link ready to copy.", link: url };
}
