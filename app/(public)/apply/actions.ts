"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { readAnswers, sectionsFor } from "@/lib/application-form";
import { readBusinessRules } from "@/lib/business-rules";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { stripe } from "@/lib/integrations/stripe/client";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { inviteMember, unitName } from "@/lib/leasing";
import { rateLimited } from "@/lib/rate-limit";
import { getPublicCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";
import { hashToken } from "@/lib/vendor-requests";

// Public leasing actions. Visitors aren't signed in, so these use the server's database access, always
// scoped to the company of the subdomain they're on.

export type ApplyState = { error?: string; message?: string };

async function companyFor() {
  const pub = await getPublicCompany();
  if (!pub) return null;
  const { data } = await createAdminClient().from("company").select("id, name, subdomain, office_email, settings, stripe_account_id, stripe_charges_enabled").eq("id", pub.id).single();
  return data;
}

/** "Ask about this rental" on a listing: becomes a guest card and tells the office. */
export async function inquire(_: ApplyState, form: FormData): Promise<ApplyState> {
  if (form.get("website")) return { message: "Thanks! We'll be in touch." }; // bots fill the hidden field
  if (await rateLimited("inquire")) return { error: "Too many messages from here. Please call the office instead." };
  const company = await companyFor();
  if (!company) return { error: "This page isn't available." };
  const p = z
    .object({
      listing_id: z.string().uuid(),
      first_name: z.string().trim().min(1, "Enter your first name.").max(60),
      last_name: z.string().trim().max(60),
      email: z.string().trim().email("Enter a valid e-mail.").or(z.literal("")),
      phone: z.string().trim().max(30),
      desired_move_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
      notes: z.string().trim().max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!p.data.email && !p.data.phone) return { error: "Add an e-mail or phone so we can reach you." };
  const db = createAdminClient();
  const { data: l } = await db.from("listing").select("unit_id, unit(label, property(name))").eq("id", p.data.listing_id).eq("company_id", company.id).eq("status", "published").maybeSingle();
  if (!l) return { error: "This rental isn't available anymore." };
  const { listing_id: _listing, ...rest } = p.data;
  void _listing;
  await db.from("guest_card").insert({ company_id: company.id, unit_id: l.unit_id, source: "website", ...rest, email: rest.email || null, phone: rest.phone || null, desired_move_in: rest.desired_move_in || null });
  if (company.office_email) {
    const content = {
      preheader: `New inquiry: ${unitName(l.unit)}`,
      heading: "New rental inquiry",
      paragraphs: [`${escapeHtml(`${rest.first_name} ${rest.last_name}`.trim())} asked about ${escapeHtml(unitName(l.unit))}.`, escapeHtml([rest.email, rest.phone].filter(Boolean).join(" · ")), rest.notes ? escapeHtml(rest.notes) : ""].filter(Boolean),
      fromLine: company.name,
    };
    await sendEmail({ to: company.office_email, subject: `New inquiry: ${unitName(l.unit)}`, html: emailHtml(content), text: emailText(content), fromName: "Parcel Manage", replyTo: rest.email || null });
  }
  return { message: "Thanks! We got your message and will be in touch soon." };
}

const coApplicants = (form: FormData) =>
  [0, 1, 2, 3]
    .map((i) => ({ first_name: String(form.get(`co_${i}_first`) ?? "").trim().slice(0, 60), last_name: String(form.get(`co_${i}_last`) ?? "").trim().slice(0, 60), email: String(form.get(`co_${i}_email`) ?? "").trim().slice(0, 120) }))
    .filter((c) => c.first_name);

/** Someone applies straight from a listing: a new application with them as the main applicant. */
export async function applyToListing(_: ApplyState, form: FormData): Promise<ApplyState> {
  if (form.get("website")) return { error: "Something went wrong." };
  if (await rateLimited("apply", 6)) return { error: "Too many applications from here. Please try again later or call the office." };
  const company = await companyFor();
  if (!company) return { error: "This page isn't available." };
  if (form.get("authorize") !== "on") return { error: "Check the box to authorize screening." };
  const db = createAdminClient();
  const listingId = z.string().uuid().safeParse(form.get("listing_id"));
  if (!listingId.success) return { error: "This rental isn't available anymore." };
  const { data: l } = await db.from("listing").select("unit_id, rent_cents, unit(kind)").eq("id", listingId.data).eq("company_id", company.id).eq("status", "published").maybeSingle();
  if (!l) return { error: "This rental isn't available anymore." };
  const read = readAnswers(sectionsFor(l.unit.kind as "residential" | "commercial", "applicant"), form);
  if ("error" in read) return read;
  const cos = coApplicants(form);
  if (cos.some((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))) return { error: "Add a valid e-mail for each other adult so we can send their application." };
  const { first_name, last_name, email, phone, move_in, occupants, pets, vehicles, ...answers } = read.answers;
  const { data: app } = await db
    .from("application")
    .insert({ company_id: company.id, unit_id: l.unit_id, kind: l.unit.kind, rent_cents: l.rent_cents, desired_move_in: move_in || null, status: "new", submitted_at: new Date().toISOString(), answers: { occupants: occupants ?? "", pets: pets ?? "", vehicles: vehicles ?? "" } })
    .select("id")
    .single();
  if (!app) return { error: "Your application couldn't be saved. Please try again." };
  const { data: me } = await db
    .from("application_member")
    .insert({ company_id: company.id, application_id: app.id, role: "applicant", first_name, last_name, email, phone, monthly_income_cents: read.incomeCents, answers, status: "applied", applied_at: new Date().toISOString(), opened_at: new Date().toISOString() })
    .select("id")
    .single();
  if (!me) return { error: "Your application couldn't be saved. Please try again." };
  await linkGuestCard(db, company.id, l.unit_id, email, app.id);
  await inviteOthers(db, company, app.id, cos, `${first_name} ${last_name}`.trim());
  return payFees(company, app.id, me.id, "applicant", email);
}

/** An invited adult (from the office or from the main applicant) fills out their part. */
export async function submitInvited(_: ApplyState, form: FormData): Promise<ApplyState> {
  const company = await companyFor();
  if (!company) return { error: "This page isn't available." };
  if (form.get("authorize") !== "on") return { error: "Check the box to authorize screening." };
  const db = createAdminClient();
  const token = String(form.get("token") ?? "");
  const { data: m } = await db.from("application_member").select("id, role, status, application_id, application(id, kind, status, unit_id)").eq("token_hash", hashToken(token)).eq("company_id", company.id).maybeSingle();
  if (!m || m.status === "applied") return { error: "This link has already been used or isn't valid." };
  if (["declined", "withdrawn", "signed"].includes(m.application.status)) return { error: "This application is closed." };
  const read = readAnswers(sectionsFor(m.application.kind as "residential" | "commercial", m.role), form);
  if ("error" in read) return read;
  const { first_name, last_name, email, phone, move_in, occupants, pets, vehicles, ...answers } = read.answers;
  const cos = m.role === "applicant" ? coApplicants(form) : [];
  if (cos.some((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))) return { error: "Add a valid e-mail for each other adult so we can send their application." };
  await db.from("application_member").update({ first_name, last_name, email, phone, monthly_income_cents: read.incomeCents, answers, status: "applied", applied_at: new Date().toISOString() }).eq("id", m.id);
  if (m.role === "applicant") {
    await db
      .from("application")
      .update({ status: "new", submitted_at: new Date().toISOString(), desired_move_in: move_in || null, answers: { occupants: occupants ?? "", pets: pets ?? "", vehicles: vehicles ?? "" } })
      .eq("id", m.application_id);
    await inviteOthers(db, company, m.application_id, cos, `${first_name} ${last_name}`.trim());
  }
  return payFees(company, m.application_id, m.id, m.role, email);
}

async function linkGuestCard(db: ReturnType<typeof createAdminClient>, companyId: string, unitId: string, email: string, applicationId: string) {
  const { data: g } = await db.from("guest_card").select("id").eq("company_id", companyId).ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (g) {
    await db.from("guest_card").update({ status: "applied", unit_id: unitId }).eq("id", g.id);
    await db.from("application").update({ guest_card_id: g.id }).eq("id", applicationId);
  }
}

async function inviteOthers(
  db: ReturnType<typeof createAdminClient>,
  company: NonNullable<Awaited<ReturnType<typeof companyFor>>>,
  applicationId: string,
  people: { first_name: string; last_name: string; email: string }[],
  invitedBy: string,
) {
  if (!people.length) return;
  const { data: a } = await db.from("application").select("unit(label, property(name))").eq("id", applicationId).single();
  for (const c of people) {
    const { data: m } = await db.from("application_member").insert({ company_id: company.id, application_id: applicationId, role: "co_applicant", ...c }).select("id, first_name, email").single();
    if (m && a) await inviteMember(db, company, m, unitName(a.unit), invitedBy);
  }
}

/**
 * Each adult pays their own application fee; the main applicant also pays the admin fee. Card only, through
 * Stripe on the company's own account. Without online payments, the office collects the fee.
 */
async function payFees(company: NonNullable<Awaited<ReturnType<typeof companyFor>>>, applicationId: string, memberId: string, role: string, email: string): Promise<ApplyState> {
  const fees = readBusinessRules(company.settings).fees;
  const due = fees.applicationFeePerAdultCents + (role === "applicant" ? fees.adminFeeCents : 0);
  const db = createAdminClient();
  const { data: a } = await db.from("application").select("fees_due_cents").eq("id", applicationId).single();
  await db.from("application").update({ fees_due_cents: (a?.fees_due_cents ?? 0) + due }).eq("id", applicationId);
  const back = (path: string) => companyUrl(company.subdomain ?? "", ROOT_DOMAIN, path);
  if (!due || !company.stripe_account_id || !company.stripe_charges_enabled) redirect(back(`/apply/done?fee=${due ? "office" : "none"}`));
  const session = await stripe<{ url: string }>(
    "POST",
    "checkout/sessions",
    {
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": "Application fee",
      "line_items[0][price_data][unit_amount]": fees.applicationFeePerAdultCents,
      "line_items[0][quantity]": 1,
      ...(role === "applicant" && fees.adminFeeCents
        ? {
            "line_items[1][price_data][currency]": "usd",
            "line_items[1][price_data][product_data][name]": `Admin fee${fees.refundAdminFeeIfDenied ? " (refunded if your application is denied)" : ""}`,
            "line_items[1][price_data][unit_amount]": fees.adminFeeCents,
            "line_items[1][quantity]": 1,
          }
        : {}),
      customer_email: email,
      "metadata[application_id]": applicationId,
      "metadata[member_id]": memberId,
      "metadata[role]": role,
      "metadata[company_id]": company.id,
      success_url: back("/apply/done?fee=paid"),
      cancel_url: back(`/apply/done?fee=unpaid&total=${due}`),
    },
    company.stripe_account_id,
  );
  redirect(session.url);
}
