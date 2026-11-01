"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseRulesForm, RULE_SECTIONS } from "@/lib/business-rules-form";
import { emailHtml, emailText, type EmailContent } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { getOrigin } from "@/lib/request";
import { isAdmin, requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";

// `values` carries what was typed back to the form after an error, so a failed save never wipes it.
export type SettingsState = {
  error?: string;
  message?: string;
  errors?: Record<string, string>;
  inviteLink?: string;
  values?: Record<string, string | boolean>;
};

function typed(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
}

const ADMIN_ONLY = "Only an admin can change this.";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export async function updateCompanyProfile(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };

  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter the company name.").max(100),
      legal_name: optional(150),
      office_phone: optional(30),
      office_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]).transform((v) => v || null),
      address: optional(200),
      default_county: optional(60),
      time_zone: z.string().min(1),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };

  const { error } = await supabase.from("company").update(parsed.data).eq("id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function updateBusinessRules(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };

  const result = parseRulesForm(form);
  if (!result.ok) {
    const values: Record<string, string | boolean> = typed(form);
    for (const section of RULE_SECTIONS)
      for (const field of section.fields) if (field.type === "boolean") values[field.path] = form.get(field.path) === "on";
    return { error: "Some values need fixing. They're marked below.", errors: result.errors, values };
  }

  const settings = { ...((company.settings as Record<string, unknown>) ?? {}), businessRules: result.rules };
  const { error } = await supabase.from("company").update({ settings }).eq("id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath("/settings/business-rules");
  return { message: "Business rules saved." };
}

const ROLES = ["admin", "property_manager", "accountant", "maintenance_coordinator", "leasing_agent", "read_only"] as const;

export async function inviteTeammate(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, company, membership, user } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };

  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      role: z.enum(ROLES),
      title: optional(80),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };

  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("invitation").insert({
    company_id: company.id,
    email: parsed.data.email,
    role: parsed.data.role,
    title: parsed.data.title,
    token_hash: createHash("sha256").update(token).digest("hex"),
    invited_by: user.id,
  });
  if (error) {
    return { error: error.code === "23505" ? `${parsed.data.email} already has a pending invite.` : error.message, values: typed(form) };
  }

  const link = company.subdomain
    ? companyUrl(company.subdomain, ROOT_DOMAIN, `/invite/${token}`)
    : `${await getOrigin()}/invite/${token}`;
  const name = escapeHtml(company.name);
  const invite: EmailContent = {
    preheader: `Join ${name} on Parcel Manage.`,
    heading: `You're invited to ${name}`,
    paragraphs: [`You've been invited to join <strong>${name}</strong> on Parcel Manage, where the team runs properties, tenants and maintenance.`, "Tap the button to accept and set up your sign-in."],
    button: { label: "Accept the invite", url: link },
    note: "This invite works for <strong>7 days</strong>.",
    fromLine: name,
    footer: [name, company.office_phone && escapeHtml(company.office_phone)].filter(Boolean).join(" · "),
  };
  const sent = await sendEmail({
    to: parsed.data.email,
    fromName: company.name,
    subject: `You're invited to ${company.name} on Parcel Manage`,
    text: emailText(invite),
    html: emailHtml(invite),
  });

  revalidatePath("/settings/team");
  return sent
    ? { message: `Invite emailed to ${parsed.data.email}.` }
    : { message: `Invite created, but the email didn't send. Send ${parsed.data.email} this link yourself:`, inviteLink: link };
}

export async function revokeInvitation(form: FormData) {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return;
  await supabase
    .from("invitation")
    .update({ status: "revoked" })
    .eq("id", String(form.get("id")))
    .eq("company_id", company.id);
  revalidatePath("/settings/team");
}

export async function updateMember(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: ADMIN_ONLY };

  const parsed = z
    .object({ id: z.string().uuid(), role: z.enum(ROLES), title: optional(80) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  if (parsed.data.id === membership.id && parsed.data.role !== "admin") {
    return { error: "You can't remove your own admin role. Ask another admin to do it." };
  }

  const { error } = await supabase
    .from("membership")
    .update({ role: parsed.data.role, title: parsed.data.title })
    .eq("id", parsed.data.id)
    .eq("company_id", company.id);
  if (error) return { error: error.message, values: typed(form) };
  revalidatePath("/", "layout");
  return { message: "Saved." };
}
