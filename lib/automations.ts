import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, expiringWithin, inPreNoticeWindow, pastDueMonth, preNoticeWindow, readAutomationSettings, renewalDecisionDue, rentReminderFor } from "@/lib/automation-rules";
import { readBusinessRules } from "@/lib/business-rules";
import { RESIDENTIAL_LEASE } from "@/lib/documents/residential-lease";
import { emailHtml, emailText } from "@/lib/email/layout";
import { contactName, date, money } from "@/lib/format";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { buildLedger } from "@/lib/ledger";
import type { Database } from "@/lib/supabase/database.types";

// The daily automations (docs/08 Phase 3). Routine messages go out on their own and are logged; anything with
// legal weight becomes a task for a person (CLAUDE.md rule 4: legal notices are never sent automatically).

type Db = SupabaseClient<Database>;
type Company = { id: string; name: string; office_email: string | null; settings: unknown; time_zone: string };

// Fla. Stat. 83.575(1)–(2): end-of-term notice days in the lease (30–60) and the 15-day pre-notice window.
const END_OF_TERM_NOTICE_DAYS = Number(RESIDENTIAL_LEASE.fields.end_of_term_notice_days?.example ?? 60);
const PRE_NOTICE_DAYS = Number(RESIDENTIAL_LEASE.fields.ld_prenotice_days?.example ?? 15);

/** Records the automation once per key; returns false when it already ran. */
async function once(db: Db, companyId: string, row: Omit<Database["public"]["Tables"]["automation_task"]["Insert"], "company_id">) {
  const { error } = await db.from("automation_task").insert({ company_id: companyId, ...row });
  return !error;
}

export async function runAutomations(db: Db, company: Company, today: string) {
  const a = readAutomationSettings(company.settings);
  const rules = readBusinessRules(company.settings);
  const counts = { rentReminders: 0, lateNoticeTasks: 0, preNoticeTasks: 0, renewalTasks: 0, insuranceReminders: 0, visitReminders: 0, entryTasks: 0 };
  if (!a.enabled) return counts;
  const { data: leases } = await db
    .from("lease")
    .select(
      "id, status, end_date, rent_cents, opening_balance_cents, opening_balance_as_of, unit(label, kind, property(name)), lease_tenant(role, contact(kind, first_name, last_name, business_name, email)), autopay(active), charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at)",
    )
    .eq("company_id", company.id)
    .in("status", ["active", "notice"]);

  for (const l of leases ?? []) {
    const tenants = l.lease_tenant.filter((t) => t.role === "tenant");
    const to = tenants.map((t) => t.contact?.email).filter((e): e is string => Boolean(e));
    const names = tenants.map((t) => contactName(t.contact)).join(" and ");
    const where = `${l.unit.property.name}${l.unit.label !== "Home" ? ` ${l.unit.label}` : ""}`;
    const { balanceCents } = buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of });
    const send = async (subject: string, paragraphs: string[]) => {
      const content = { preheader: subject, heading: subject, paragraphs, fromLine: company.name };
      return to.length ? sendEmail({ to, subject, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email }) : false;
    };

    // Rent reminder: a friendly e-mail, skipped for tenants on autopay.
    const due = a.rentReminders ? rentReminderFor(today, rules.rent.dueDay, a.rentReminderDaysBefore) : null;
    if (due && to.length && !l.autopay.some((x) => x.active)) {
      if (await once(db, company.id, { key: `rent-reminder:${l.id}:${due}`, kind: "rent_reminder", lease_id: l.id, title: `Rent reminder sent: ${where}`, due_on: due, status: "sent" })) {
        await send("Rent reminder", [`Hi ${escapeHtml(names)},`, `A friendly reminder that rent of ${money(l.rent_cents)} is due on ${date(due)}.${balanceCents > 0 ? ` Your balance right now is ${money(balanceCents)}.` : ""} You can pay any time in your resident portal.`, "Thank you!"]);
        counts.rentReminders++;
      }
    }

    // Past-due rent: a task to prepare the 3-day notice (83.56(3)); never sent automatically.
    const month = a.lateNoticeTasks ? pastDueMonth(today, rules.rent.lateFeeDay) : null;
    if (month && balanceCents > 0) {
      if (
        await once(db, company.id, {
          key: `three-day:${l.id}:${month}`,
          kind: "three_day_notice",
          lease_id: l.id,
          title: `Rent past due: ${where}`,
          detail: `${names} owe ${money(balanceCents)}. Review the ledger, then prepare and deliver the 3-day notice to pay rent or deliver possession (Fla. Stat. 83.56(3)) if it's still unpaid.`,
          letter_template: "three-day",
          due_on: today,
        })
      )
        counts.lateNoticeTasks++;
    }

    if (l.end_date && l.unit.kind !== "commercial") {
      // 83.575(2) pre-notice window: a task, because it's a legal notice.
      if (a.renewalTasks && inPreNoticeWindow(today, l.end_date, END_OF_TERM_NOTICE_DAYS, PRE_NOTICE_DAYS)) {
        const w = preNoticeWindow(l.end_date, END_OF_TERM_NOTICE_DAYS, PRE_NOTICE_DAYS);
        if (
          await once(db, company.id, {
            key: `pre-notice:${l.id}:${l.end_date}`,
            kind: "end_of_term_pre_notice",
            lease_id: l.id,
            title: `Send the end-of-term notice reminder: ${where}`,
            detail: `Lease ends ${date(l.end_date)}. Deliver the 83.575(2) reminder by ${date(w.lastDay)} (the tenant's ${END_OF_TERM_NOTICE_DAYS}-day notice period starts ${date(w.periodStarts)}). Without it, liquidated damages for leaving without notice can't be charged.`,
            letter_template: "end-of-term-reminder",
            due_on: w.lastDay,
          })
        )
          counts.preNoticeTasks++;
      }
      // Renewal decision once the lease is inside the renewal lead time.
      if (a.renewalTasks && l.status === "active" && renewalDecisionDue(today, l.end_date, rules.expirations.renewalOfferDays)) {
        if (
          await once(db, company.id, {
            key: `renewal:${l.id}:${l.end_date}`,
            kind: "renewal_decision",
            lease_id: l.id,
            title: `Renew or not: ${where}`,
            detail: `Lease ends ${date(l.end_date)}. Send a renewal offer, or a notice of non-renewal at least ${END_OF_TERM_NOTICE_DAYS} days before the end (Fla. Stat. 83.575(1)), by ${date(addDays(l.end_date, -END_OF_TERM_NOTICE_DAYS))}.`,
            letter_template: "renewal-offer",
            due_on: addDays(l.end_date, -END_OF_TERM_NOTICE_DAYS),
          })
        )
          counts.renewalTasks++;
      }
    }
  }

  // Renters insurance about to lapse: remind the tenant.
  if (a.insuranceReminders) {
    const { data: policies } = await db
      .from("renters_insurance")
      .select("id, expires_on, lease_id, carrier, contact:tenant_contact_id(kind, first_name, last_name, business_name, email)")
      .eq("company_id", company.id)
      .not("expires_on", "is", null)
      .lte("expires_on", addDays(today, a.insuranceReminderDays))
      .gte("expires_on", today);
    for (const p of policies ?? []) {
      if (!p.contact?.email || !expiringWithin(today, p.expires_on, a.insuranceReminderDays)) continue;
      if (await once(db, company.id, { key: `insurance:${p.id}:${p.expires_on}`, kind: "insurance_reminder", lease_id: p.lease_id, title: `Insurance reminder sent: ${contactName(p.contact)}`, due_on: p.expires_on, status: "sent" })) {
        const content = {
          preheader: "Your renters insurance is about to expire.",
          heading: "Your renters insurance expires soon",
          paragraphs: [`Hi ${escapeHtml(contactName(p.contact))},`, `Our records show your renters insurance${p.carrier ? ` with ${escapeHtml(p.carrier)}` : ""} expires on ${date(p.expires_on)}. Your lease requires coverage. Please renew it and upload the new declarations page in your resident portal (My lease).`],
          fromLine: company.name,
        };
        await sendEmail({ to: p.contact.email, subject: "Your renters insurance expires soon", html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
        counts.insuranceReminders++;
      }
    }
  }

  // Repair visits tomorrow: remind the tenant, and flag any visit still missing its 24-hour entry notice (83.53(2)).
  const tomorrow = addDays(today, 1);
  const { data: visits } = await db
    .from("work_order")
    .select("id, title, scheduled_start, entry_basis, entry_notice_at, unit(label, property(name), lease(id, status, lease_tenant(role, contact(email, first_name))))")
    .eq("company_id", company.id)
    .not("scheduled_start", "is", null)
    .gte("scheduled_start", `${addDays(today, -1)}T00:00:00Z`)
    .lte("scheduled_start", `${addDays(today, 3)}T00:00:00Z`);
  for (const w of visits ?? []) {
    const local = new Date(w.scheduled_start!).toLocaleDateString("en-CA", { timeZone: company.time_zone });
    if (local !== tomorrow) continue;
    const when = new Date(w.scheduled_start!).toLocaleString("en-US", { timeZone: company.time_zone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
    const where = w.unit ? `${w.unit.property.name}${w.unit.label !== "Home" ? ` ${w.unit.label}` : ""}` : "the property";
    const lease = w.unit?.lease.find((x) => x.status === "active" || x.status === "notice") ?? null;
    if (w.entry_basis === "notice" && !w.entry_notice_at) {
      if (
        await once(db, company.id, {
          key: `entry:${w.id}:${local}`,
          kind: "entry_notice",
          work_order_id: w.id,
          lease_id: lease?.id ?? null,
          title: `Entry notice needed today: ${where}`,
          detail: `${w.title} is scheduled ${when}. Post or hand-deliver the 24-hour entry notice today and record it on the work order (Fla. Stat. 83.53(2)), or reschedule.`,
          letter_template: "entry",
          due_on: today,
        })
      )
        counts.entryTasks++;
    }
    const to = (lease?.lease_tenant ?? []).filter((t) => t.role === "tenant" && t.contact?.email).map((t) => t.contact!.email!);
    if (a.visitReminders && to.length && (w.entry_basis !== "notice" || w.entry_notice_at)) {
      if (await once(db, company.id, { key: `visit:${w.id}:${local}`, kind: "visit_reminder", work_order_id: w.id, lease_id: lease?.id ?? null, title: `Visit reminder sent: ${where}`, due_on: local, status: "sent" })) {
        const content = { preheader: `Repair visit ${when}`, heading: "Repair visit tomorrow", paragraphs: [`A reminder: ${escapeHtml(w.title)} is scheduled for ${escapeHtml(when)}. Please secure pets. If the time doesn't work, reply or call us.`], fromLine: company.name };
        await sendEmail({ to, subject: "Reminder: repair visit tomorrow", html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
        counts.visitReminders++;
      }
    }
  }
  return counts;
}
