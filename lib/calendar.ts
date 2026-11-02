import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contactName, oneLineAddress } from "@/lib/format";
import { parseIcs, type BusyEvent, type CalEvent } from "@/lib/ical";
import type { Database } from "@/lib/supabase/database.types";

// The dates Parcel Manage puts on a calendar (showings, repair visits, move-outs, lease ends, to-dos), and the
// person's own calendars read from their secret iCal addresses. Used by the Calendar page and the private
// subscription feed (app/api/calendar/[token]).

type Db = SupabaseClient<Database>;
export type CompanyEvent = CalEvent & { kind: "showing" | "repair" | "move_out" | "lease_end" | "todo"; href: string };

const where = (u: { label: string; property: { name: string } | null } | null) => (u ? `${u.property?.name ?? ""}${u.label !== "Home" ? ` ${u.label}` : ""}` : "");

export async function companyEvents(db: Db, companyId: string, from: string, to: string, baseUrl: string): Promise<CompanyEvent[]> {
  const [{ data: showings }, { data: visits }, { data: leases }, { data: tasks }] = await Promise.all([
    db.from("showing").select("id, starts_at, guest_card(first_name, last_name), unit(label, property(name, address_line1, city, state, postal_code))").eq("company_id", companyId).eq("status", "scheduled").gte("starts_at", from).lt("starts_at", to),
    db
      .from("work_order")
      .select("id, number, title, scheduled_start, scheduled_end, vendor(contact(first_name, last_name, business_name)), unit(label, property(name)), property(name, address_line1, city, state, postal_code)")
      .eq("company_id", companyId)
      .in("status", ["assigned", "scheduled"])
      .not("scheduled_start", "is", null)
      .gte("scheduled_start", from)
      .lt("scheduled_start", to),
    db.from("lease").select("id, status, end_date, move_out_on, unit(label, property(name)), lease_tenant(is_primary, role, contact(first_name, last_name, business_name))").eq("company_id", companyId).in("status", ["active", "notice"]),
    db.from("automation_task").select("id, title, due_on, work_order_id, lease_id").eq("company_id", companyId).eq("status", "open").gte("due_on", from.slice(0, 10)).lt("due_on", to.slice(0, 10)),
  ]);
  const out: CompanyEvent[] = [];
  for (const s of showings ?? [])
    out.push({ kind: "showing", uid: `showing-${s.id}@parcelmanage`, title: `Showing: ${where(s.unit)}${s.guest_card ? ` (${[s.guest_card.first_name, s.guest_card.last_name].filter(Boolean).join(" ")})` : ""}`, start: s.starts_at, end: new Date(new Date(s.starts_at).getTime() + 30 * 60_000).toISOString(), location: s.unit?.property ? oneLineAddress(s.unit.property) : null, href: "/leasing", url: `${baseUrl}/leasing` });
  for (const w of visits ?? [])
    out.push({
      kind: "repair",
      uid: `wo-${w.id}@parcelmanage`,
      title: `Repair #${w.number}: ${w.title} (${w.unit ? where(w.unit) : (w.property?.name ?? "")})`,
      start: w.scheduled_start!,
      end: w.scheduled_end ?? null,
      location: w.property ? oneLineAddress(w.property) : null,
      description: w.vendor ? `Vendor: ${contactName(w.vendor.contact)}` : null,
      href: `/maintenance/${w.id}`,
      url: `${baseUrl}/maintenance/${w.id}`,
    });
  for (const l of leases ?? []) {
    const who = contactName([...l.lease_tenant].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact);
    if (l.status === "notice" && l.move_out_on && l.move_out_on >= from.slice(0, 10) && l.move_out_on < to.slice(0, 10))
      out.push({ kind: "move_out", uid: `moveout-${l.id}@parcelmanage`, title: `Move-out: ${[who, where(l.unit)].filter(Boolean).join(", ")}`, start: l.move_out_on, allDay: true, href: `/tenants/${l.id}`, url: `${baseUrl}/tenants/${l.id}` });
    else if (l.end_date && l.end_date >= from.slice(0, 10) && l.end_date < to.slice(0, 10))
      out.push({ kind: "lease_end", uid: `leaseend-${l.id}@parcelmanage`, title: `Lease ends: ${[who, where(l.unit)].filter(Boolean).join(", ")}`, start: l.end_date, allDay: true, href: `/tenants/${l.id}`, url: `${baseUrl}/tenants/${l.id}` });
  }
  for (const t of tasks ?? []) {
    const href = t.work_order_id ? `/maintenance/${t.work_order_id}` : t.lease_id ? `/tenants/${t.lease_id}` : "/tasks";
    out.push({ kind: "todo", uid: `task-${t.id}@parcelmanage`, title: `To do: ${t.title}`, start: t.due_on!, allDay: true, href, url: `${baseUrl}${href}` });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** This person's own calendars, read from their secret iCal addresses (each read is recorded, errors too). */
export async function personalEvents(db: Db, companyId: string, profileId: string, from: Date, to: Date, timeZone: string): Promise<(BusyEvent & { calendar: string })[]> {
  const { data: cals } = await db.from("external_calendar").select("id, name, ics_url").eq("company_id", companyId).eq("profile_id", profileId);
  const lists = await Promise.all(
    (cals ?? []).map(async (c) => {
      try {
        const res = await fetch(c.ics_url, { signal: AbortSignal.timeout(10_000), headers: { Accept: "text/calendar" } });
        if (!res.ok) throw new Error(res.status === 404 ? "The address no longer works (it may have been reset in Google Calendar)." : `The calendar couldn't be read (${res.status}).`);
        const text = await res.text();
        if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That address isn't a calendar feed. Use the secret address in iCal format.");
        await db.from("external_calendar").update({ last_fetched_at: new Date().toISOString(), last_error: null }).eq("id", c.id);
        return parseIcs(text, from, to, timeZone).map((e) => ({ ...e, calendar: c.name }));
      } catch (e) {
        await db.from("external_calendar").update({ last_error: e instanceof Error ? e.message.slice(0, 200) : "Couldn't be read." }).eq("id", c.id);
        return [];
      }
    }),
  );
  return lists.flat().sort((a, b) => a.start.localeCompare(b.start));
}
