import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextDepositStep } from "@/lib/deposits";
import { contactName, money } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";
import { listTenants } from "@/lib/tenants";
import { listWorkOrders } from "@/lib/work-order-list";
import { aiComplete } from "./provider";

// The AI assistant panel: read-only questions answered from a plain-text summary of the company's records,
// built with the signed-in person's own access (Row Level Security), so it sees only what they can see.
// It never changes anything; the "Needs approval" list links to where a person acts.

type Db = SupabaseClient<Database>;
type Company = { id: string; name: string };

export type Approval = { label: string; count: number; href: string; detail?: string; urgent?: boolean };

/** What's waiting on a person, with where to act. */
export async function approvals(db: Db, company: Company, today: string): Promise<Approval[]> {
  const [{ data: bills }, { data: tasks }, { data: moveOuts }, { data: signatures }, { data: newOrders }] = await Promise.all([
    db.from("bill").select("amount_cents").eq("company_id", company.id).eq("status", "received"),
    db.from("automation_task").select("due_on").eq("company_id", company.id).eq("status", "open"),
    db.from("move_out").select("vacated_on, decision, claim_notice_sent_on, claim_notice_method").eq("company_id", company.id).is("closed_at", null),
    db.from("signature_request").select("id").eq("company_id", company.id).eq("status", "sent"),
    db.from("work_order").select("priority").eq("company_id", company.id).eq("status", "new"),
  ]);
  const deposits = (moveOuts ?? []).map((m) => nextDepositStep(m, today)).sort((a, b) => a.next.localeCompare(b.next));
  const emergencies = (newOrders ?? []).filter((w) => w.priority === "emergency").length;
  const overdueTasks = (tasks ?? []).filter((t) => t.due_on && t.due_on < today).length;
  const items: Approval[] = [
    { label: "Bills to approve", count: bills?.length ?? 0, href: "/bills", detail: bills?.length ? money(bills.reduce((s, b) => s + b.amount_cents, 0)) : undefined },
    { label: "To do: notices and decisions", count: tasks?.length ?? 0, href: "/tasks", detail: overdueTasks ? `${overdueTasks} past due` : undefined, urgent: overdueTasks > 0 },
    { label: "Deposit deadlines (Fla. Stat. 83.49)", count: deposits.length, href: "/inspections", detail: deposits[0] ? `next: ${deposits[0].label.toLowerCase()} in ${deposits[0].left} days` : undefined, urgent: deposits.some((d) => d.left <= 3) },
    { label: "New work orders to assign", count: newOrders?.length ?? 0, href: "/maintenance", detail: emergencies ? `${emergencies} emergency` : undefined, urgent: emergencies > 0 },
    { label: "Out for signature", count: signatures?.length ?? 0, href: "/e-sign" },
  ];
  return items.filter((i) => i.count > 0);
}

/** The records the assistant answers from, as compact text (no contact details, no bank or ID numbers). */
export async function snapshot(db: Db, company: Company, today: string): Promise<string> {
  const [tenants, workOrders, { data: properties }, { data: moveOuts }, { data: bills }, { data: owners }] = await Promise.all([
    listTenants(db, company.id, { q: "", property: "", show: "" }, today),
    listWorkOrders(db, company.id, { q: "", view: "open", priority: "", property: "" }),
    db.from("property").select("name, entity(name), unit(label, status, kind, market_rent_cents)").eq("company_id", company.id).order("name"),
    db.from("move_out").select("vacated_on, decision, claim_notice_sent_on, claim_notice_method, lease(unit(label, property(name)), lease_tenant(is_primary, role, contact(kind, first_name, last_name, business_name)))").eq("company_id", company.id).is("closed_at", null),
    db.from("bill").select("amount_cents, due_date, status, vendor(contact(kind, first_name, last_name, business_name)), property(name)").eq("company_id", company.id).in("status", ["received", "approved"]),
    db.from("entity").select("name, property(name)").eq("company_id", company.id).order("name"),
  ]);
  const lines: string[] = [`Company: ${company.name}. Today: ${today}. Money in US dollars.`];
  lines.push("", "PROPERTIES (name | owner | units: label status kind market rent)");
  for (const p of properties ?? []) {
    lines.push(`${p.name} | ${p.entity?.name ?? "no owner"} | ${p.unit.map((u) => `${u.label} ${u.status} ${u.kind}${u.market_rent_cents ? ` ${money(u.market_rent_cents)}` : ""}`).join("; ")}`);
  }
  lines.push("", "OWNERS", ...(owners ?? []).map((o) => `${o.name}: ${o.property.map((p) => p.name).join(", ") || "no properties"}`));
  lines.push("", "LEASES (tenant | property unit | status | rent | balance owed (negative = credit) | start | end | days left)");
  for (const t of tenants.slice(0, 400)) {
    lines.push(`${t.name || "No tenant"} | ${t.propertyName} ${t.unitLabel} | ${t.status} | ${money(t.rentCents)} | ${money(t.balanceCents ?? 0)} | ${t.startDate} | ${t.endDate ?? "month to month"} | ${t.timing.daysLeft ?? "-"}`);
  }
  lines.push("", "OPEN WORK ORDERS (number | title | priority | status | property unit | vendor | created)");
  for (const w of workOrders.slice(0, 200)) {
    lines.push(`#${w.number} | ${w.title} | ${w.priority} | ${w.status} | ${w.property.name}${w.unit ? ` ${w.unit.label}` : ""} | ${w.vendor ? contactName(w.vendor.contact) : "unassigned"} | ${w.created_at.slice(0, 10)}`);
  }
  lines.push("", "OPEN MOVE-OUTS AND DEPOSITS (tenant | property | moved out | next step | due)");
  for (const m of moveOuts ?? []) {
    const step = nextDepositStep(m, today);
    const t = [...m.lease.lease_tenant].filter((x) => x.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
    lines.push(`${contactName(t?.contact)} | ${m.lease.unit.property.name} ${m.lease.unit.label} | ${m.vacated_on} | ${step.label} | ${step.next}`);
  }
  lines.push("", "UNPAID BILLS (vendor | property | amount | due | status)");
  for (const b of bills ?? []) lines.push(`${contactName(b.vendor?.contact)} | ${b.property?.name ?? "-"} | ${money(b.amount_cents)} | ${b.due_date ?? "-"} | ${b.status}`);
  return lines.join("\n");
}

const SYSTEM = (companyName: string) =>
  `You are the read-only assistant inside Parcel Manage, the property management software used by ${companyName} in Florida. Answer the staff member's question using only the records provided. Be short and plain: a sentence or two, or a short list. Give totals when asked and show the numbers you used. If the records don't contain the answer, say so and say which Parcel Manage screen would have it (Tenants & leases, Maintenance, Accounting, Bills, Reports, Owners, Inspections & deposits). You cannot change anything or send anything; if asked to, explain where in Parcel Manage the person can do it. Don't give legal advice; you may name the Florida statute section that applies (for example Fla. Stat. 83.56 for notices, 83.49 for deposits) and suggest checking with the company's attorney.`;

export async function askAssistant(db: Db, company: Company, today: string, question: string): Promise<{ ok: true; answer: string } | { ok: false; reason: string }> {
  const data = await snapshot(db, company, today);
  const r = await aiComplete({ companyId: company.id, feature: "assistant", system: SYSTEM(company.name), prompt: `RECORDS\n${data}\n\nQUESTION\n${question}`, maxTokens: 700, timeoutMs: 30_000 });
  return r.ok ? { ok: true, answer: r.text } : { ok: false, reason: r.reason };
}
