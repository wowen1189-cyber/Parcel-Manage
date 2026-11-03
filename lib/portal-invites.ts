import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, emailText, type EmailContent } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { contactName } from "@/lib/format";
import { UNASSIGNED_OWNER } from "@/lib/owners";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import type { Database } from "@/lib/supabase/database.types";
import { companyUrl } from "@/lib/tenant";

// Portal invitations (migration 0060). Nobody gets into the tenant or owner portal until the office invites
// them: the invite e-mails the sign-in link and records the date, which is what opens the portal for them.
// Invites go one at a time (tenant page) or in bulk (Tenants › Portal invites, Owners › Portal invites).

type Db = SupabaseClient<Database>;
type Company = { id: string; name: string; subdomain: string | null; office_phone: string | null; office_email: string | null };

export type Invitee = {
  /** "t:<contact id>" tenant, "e:<entity id>" owner record, "p:<contact id>" property partner. */
  key: string;
  name: string;
  /** How the e-mail greets them: a person's first name, otherwise the full name. */
  greet: string;
  /** Where they rent, or which owner they belong to. */
  detail: string;
  emails: string[];
  invitedAt: string | null;
  usingPortal: boolean;
};

/** Every address in an e-mail field ("a@x.com, b@y.com"); the portal accepts any of them. */
export function emailList(raw: string | null | undefined): string[] {
  const all = (raw ?? "").split(/[,;]/).map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return all.filter((e, i) => all.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === i);
}

/** Tenants on current and upcoming leases (not guarantors or occupants), one row per person. */
export async function listTenantInvitees(db: Db, companyId: string): Promise<Invitee[]> {
  const { data } = await db
    .from("lease_tenant")
    .select("role, contact!inner(id, kind, first_name, last_name, business_name, email, portal_profile_id, portal_invited_at), lease!inner(status, unit!inner(label, property!inner(name)))")
    .eq("company_id", companyId)
    .eq("role", "tenant")
    .in("lease.status", ["active", "notice", "pending_signature", "draft"]);
  const seen = new Map<string, Invitee>();
  for (const r of data ?? []) {
    const c = r.contact;
    const where = `${r.lease.unit.property.name} · ${r.lease.unit.label}`;
    const had = seen.get(c.id);
    if (had) {
      had.detail += `, ${where}`;
      continue;
    }
    seen.set(c.id, { key: `t:${c.id}`, name: contactName(c) || "Unnamed tenant", greet: (c.business_name ? "" : c.first_name) || contactName(c) || "there", detail: where, emails: emailList(c.email), invitedAt: c.portal_invited_at, usingPortal: Boolean(c.portal_profile_id) });
  }
  return [...seen.values()].sort((a, b) => a.detail.localeCompare(b.detail) || a.name.localeCompare(b.name));
}

/** Owners (the e-mail on the owner record) and each property's partners. Optionally just one owner. */
export async function listOwnerInvitees(db: Db, companyId: string, ownerId?: string): Promise<Invitee[]> {
  let q = db
    .from("entity")
    .select("id, name, email, portal_invited_at, property(property_owner(contact(id, kind, first_name, last_name, business_name, email, owner_portal_invited_at)))")
    .eq("company_id", companyId)
    .neq("name", UNASSIGNED_OWNER)
    .order("name");
  if (ownerId) q = q.eq("id", ownerId);
  const { data } = await q;
  const rows: Invitee[] = [];
  const partners = new Map<string, Invitee>();
  for (const e of data ?? []) {
    if (!e.property.length && !ownerId) continue;
    rows.push({ key: `e:${e.id}`, name: e.name, greet: e.name, detail: "Owner", emails: emailList(e.email), invitedAt: e.portal_invited_at, usingPortal: false });
    for (const po of e.property.flatMap((p) => p.property_owner)) {
      const c = po.contact;
      if (!c) continue;
      const had = partners.get(c.id);
      if (had) {
        if (!had.detail.includes(e.name)) had.detail += `, ${e.name}`;
        continue;
      }
      const p: Invitee = { key: `p:${c.id}`, name: contactName(c) || "Unnamed partner", greet: (c.business_name ? "" : c.first_name) || contactName(c) || "there", detail: `Partner in ${e.name}`, emails: emailList(c.email), invitedAt: c.owner_portal_invited_at, usingPortal: false };
      partners.set(c.id, p);
      rows.push(p);
    }
  }
  return rows;
}

function inviteEmail(company: Company, kind: "tenant" | "owner", name: string, emails: string[]): { subject: string; content: EmailContent } {
  const link = companyUrl(company.subdomain!, ROOT_DOMAIN, kind === "tenant" ? "/sign-in?next=/portal" : "/sign-in?next=/owner");
  const signIn = `Sign in with <strong>${escapeHtml(emails[0])}</strong>${emails.length > 1 ? " (or another address we have for you)" : ""}. We'll e-mail you a sign-in link; there's no password to remember.`;
  const tenant = kind === "tenant";
  return {
    subject: tenant ? `Your ${company.name} tenant portal` : `Your ${company.name} owner portal`,
    content: {
      preheader: tenant ? `Pay rent, request repairs and message ${company.name} online.` : `See your properties, statements and documents online.`,
      heading: tenant ? "Your tenant portal is ready" : "Your owner portal is ready",
      paragraphs: [
        `Hi ${escapeHtml(name)},`,
        tenant
          ? `${escapeHtml(company.name)} has a tenant portal where you can see what you owe, pay rent, request repairs (with photos), see your lease, keep your insurance and vehicles up to date, and message the office.`
          : `${escapeHtml(company.name)} has an owner portal where you can see your properties, monthly statements, distributions and the documents we share with you, like leases.`,
        signIn,
      ],
      button: { label: tenant ? "Open my portal" : "Open my owner portal", url: link },
      fromLine: company.name,
      footer: [company.name, company.office_phone].filter(Boolean).join(" · "),
    },
  };
}

export type InviteResult = { sent: string[]; skipped: string[]; failed: string[] };

/**
 * E-mails each invitee their portal link and records the date (which opens the portal for them).
 * Keys come from listTenantInvitees / listOwnerInvitees; anything not in those lists is ignored.
 */
export async function sendInvites(db: Db, company: Company, keys: string[]): Promise<InviteResult> {
  const result: InviteResult = { sent: [], skipped: [], failed: [] };
  if (!company.subdomain) return { ...result, failed: keys };
  const wanted = new Set(keys);
  const pool = [
    ...(keys.some((k) => k.startsWith("t:")) ? await listTenantInvitees(db, company.id) : []),
    ...(keys.some((k) => !k.startsWith("t:")) ? await listOwnerInvitees(db, company.id) : []),
  ].filter((i) => wanted.has(i.key));
  for (const [n, i] of pool.entries()) {
    if (!i.emails.length) {
      result.skipped.push(i.name);
      continue;
    }
    const kind = i.key.startsWith("t:") ? "tenant" : "owner";
    const { subject, content } = inviteEmail(company, kind, i.greet, i.emails);
    // Resend allows a few e-mails a second.
    if (n) await new Promise((r) => setTimeout(r, 600));
    const ok = await sendEmail({ to: i.emails, subject, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
    if (!ok) {
      result.failed.push(i.name);
      continue;
    }
    const id = i.key.slice(2);
    const now = new Date().toISOString();
    const { error } =
      i.key.startsWith("e:")
        ? await db.from("entity").update({ portal_invited_at: now }).eq("id", id).eq("company_id", company.id)
        : await db.from("contact").update(i.key.startsWith("t:") ? { portal_invited_at: now } : { owner_portal_invited_at: now }).eq("id", id).eq("company_id", company.id);
    if (error) result.failed.push(i.name);
    else result.sent.push(i.name);
  }
  return result;
}

export function inviteSummary(r: InviteResult): { message?: string; error?: string } {
  const parts = [
    r.sent.length ? `Invite sent to ${r.sent.length === 1 ? r.sent[0] : `${r.sent.length} people`}.` : "",
    r.skipped.length ? `Skipped (no e-mail): ${r.skipped.join(", ")}.` : "",
    r.failed.length ? `Couldn't send to: ${r.failed.join(", ")}. Try again in a minute.` : "",
  ].filter(Boolean);
  return r.sent.length ? { message: parts.join(" ") } : { error: parts.join(" ") || "Nobody was selected." };
}

/** How the invite checklist shows a person. */
export function inviteRow(i: Invitee, timeZone: string) {
  const status = i.usingPortal ? "using" : i.invitedAt ? "invited" : i.emails.length ? "new" : "no-email";
  const invitedOn = i.invitedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(i.invitedAt)) : undefined;
  return { key: i.key, name: i.name, detail: i.detail, email: i.emails.join(", "), status, invitedOn } as const;
}
