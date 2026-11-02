// Keeps a company's Parcel Manage records current with AppFolio until the switch, from fresh AppFolio exports.
// Run: npm run sync:appfolio                (preview: reads the newest exports in imports/, changes nothing)
//      npm run sync:appfolio -- --commit    (applies the updates below)
//      add --company=<subdomain> for another company (default simreipm)
//
// Applied automatically: rent, deposit, lease dates and status, next rent increase, unit market rent and
// status, and each tenant's AppFolio balance (only while nothing has been posted to the books yet: before the
// cutover, a balance is just the starting figure). Open AppFolio work orders are added once each (no vendor
// e-mail is sent; AppFolio already notified them). Anything that needs a person (a new or ended lease, a
// different tenant, a new unit or vendor) is listed instead of changed.
// Exports (git-ignored, they hold tenant details): rent_roll-YYYYMMDD.csv (all columns), vendor_directory-*,
// work_order-* (AppFolio Reports › Actions › Export as CSV).

import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readRentRoll, readVendorDirectory, type RentRollLease } from "../lib/import/appfolio.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");
const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const commit = process.argv.includes("--commit");
const subdomain = process.argv.find((a) => a.startsWith("--company="))?.split("=")[1] ?? "simreipm";

/** The newest export of a report, and its date (from the file name). */
function newest(prefix: string): { path: string; date: string } | null {
  const f = readdirSync("imports")
    .filter((n) => new RegExp(`^${prefix}-\\d{8}\\.csv$`).test(n))
    .sort()
    .at(-1);
  if (!f) return null;
  const d = f.match(/(\d{4})(\d{2})(\d{2})/)!;
  return { path: `imports/${f}`, date: `${d[1]}-${d[2]}-${d[3]}` };
}

const money = (c: number | null | undefined) => (c == null ? "none" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
const monthsBetween = (start: string, end: string | null) => (end ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 30.44))) : null);
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const usDate = (s: string) => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

/** A simple CSV reader for the work order export (quoted fields, commas inside quotes). */
function csvRows(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows;
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function main() {
  const { data: company } = await db.from("company").select("id, name, settings").eq("subdomain", subdomain).single();
  if (!company) throw new Error(`No company at ${subdomain}.`);
  const cid = company.id;
  const roll = newest("rent_roll");
  if (!roll) throw new Error("No rent_roll-YYYYMMDD.csv in imports/.");
  console.log(`${company.name}: syncing from AppFolio exports of ${roll.date}${commit ? "" : " (preview, nothing changes)"}\n`);

  // Balances are only starting figures until something is posted to the books.
  const { count: entries } = await db.from("journal_entry").select("id", { count: "exact", head: true }).eq("company_id", cid);
  const booksStarted = (entries ?? 0) > 0;

  const [{ data: props }, { data: vendorRows }] = await Promise.all([
    db
      .from("property")
      .select("id, name, unit(id, label, status, market_rent_cents, lease(id, status, start_date, end_date, rent_cents, deposit_cents, next_rent_increase_on, next_rent_cents, opening_balance_cents, opening_balance_as_of, lease_tenant(is_primary, role, contact(first_name, last_name, business_name))))")
      .eq("company_id", cid),
    db.from("vendor").select("id, contact(first_name, last_name, business_name)").eq("company_id", cid),
  ]);
  const byProperty = new Map((props ?? []).map((p) => [p.name, p]));
  const changes: string[] = [];
  const needsPerson: string[] = [];
  let applied = 0;

  const apply = async (label: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
    changes.push(label);
    if (!commit) return;
    const { error } = await run();
    if (error) throw new Error(`${label}: ${error.message}`);
    applied++;
  };

  // ---------- rent roll ----------
  for (const p of readRentRoll(readFileSync(roll.path, "utf8"))) {
    const prop = byProperty.get(p.name);
    if (!prop) {
      needsPerson.push(`New property in AppFolio: ${p.name} (${p.units.length} units). Add it in Properties, or import it.`);
      continue;
    }
    for (const u of p.units) {
      const unit = prop.unit.find((x) => x.label === u.label);
      const where = `${p.name}${u.label !== "Home" ? ` ${u.label}` : ""}`;
      if (!unit) {
        needsPerson.push(`New unit in AppFolio: ${where}.`);
        continue;
      }
      const unitPatch: Database["public"]["Tables"]["unit"]["Update"] = {};
      if (u.market_rent_cents != null && u.market_rent_cents !== unit.market_rent_cents) unitPatch.market_rent_cents = u.market_rent_cents;
      if (u.status !== unit.status) unitPatch.status = u.status;
      if (Object.keys(unitPatch).length)
        await apply(`${where}: ${Object.entries(unitPatch).map(([k, v]) => `${k.replace(/_/g, " ").replace(" cents", "")} → ${k.endsWith("cents") ? money(v as number) : v}`).join(", ")}`, () => db.from("unit").update(unitPatch).eq("id", unit.id));

      const current = unit.lease.find((l) => l.status === "active" || l.status === "notice");
      const l = u.lease;
      if (!l && current) {
        needsPerson.push(`${where}: AppFolio shows no current lease, Parcel Manage still has one. Record the move-out in Parcel Manage if the tenant left.`);
        continue;
      }
      if (!l) continue;
      if (!current) {
        needsPerson.push(`${where}: new lease in AppFolio for ${l.tenant} from ${l.start_date}. Add it in Tenants & leases.`);
        continue;
      }
      const primary = current.lease_tenant.find((t) => t.is_primary && t.role === "tenant")?.contact;
      const name = primary ? [primary.business_name, primary.first_name, primary.last_name].filter(Boolean).join(" ") : "";
      if (norm(name) && !norm(l.tenant).includes(norm(primary?.last_name ?? primary?.business_name ?? name).slice(0, 6))) {
        needsPerson.push(`${where}: AppFolio's tenant (${l.tenant}) differs from Parcel Manage's (${name}). Check whether this is a new lease.`);
        continue;
      }
      if (l.start_date !== current.start_date) {
        needsPerson.push(`${where}: AppFolio's lease starts ${l.start_date}, Parcel Manage's ${current.start_date}. A renewal? Renew it in Parcel Manage.`);
        continue;
      }
      const leasePatch: Database["public"]["Tables"]["lease"]["Update"] = {};
      const said: string[] = [];
      const set = <K extends keyof RentRollLease & keyof typeof current>(k: K, label: string, show: (v: unknown) => string) => {
        if (l[k] !== undefined && (l[k] as unknown) !== (current[k] as unknown)) {
          (leasePatch as Record<string, unknown>)[k] = l[k];
          said.push(`${label} ${show(current[k])} → ${show(l[k])}`);
        }
      };
      set("rent_cents", "rent", (v) => money(v as number));
      set("deposit_cents", "deposit", (v) => money(v as number));
      set("end_date", "lease end", (v) => String(v ?? "month to month"));
      set("status", "status", String);
      set("next_rent_increase_on", "next increase", (v) => String(v ?? "none"));
      set("next_rent_cents", "next rent", (v) => money(v as number));
      if (leasePatch.end_date !== undefined) leasePatch.term_months = monthsBetween(current.start_date, l.end_date);
      if (!booksStarted && (l.past_due_cents ?? null) !== current.opening_balance_cents) {
        leasePatch.opening_balance_cents = l.past_due_cents;
        leasePatch.opening_balance_as_of = roll.date;
        said.push(`balance ${money(current.opening_balance_cents)} → ${money(l.past_due_cents)}`);
      }
      if (said.length) await apply(`${where}: ${said.join(", ")}`, () => db.from("lease").update(leasePatch).eq("id", current.id));
    }
  }
  if (booksStarted) needsPerson.push("Balances weren't updated: entries are already posted in Parcel Manage, so balances now come from its own ledger.");

  // ---------- vendors: new ones are listed ----------
  const vendorFile = newest("vendor_directory");
  const vendorNames = (vendorRows ?? []).map((v) => norm([v.contact.business_name, v.contact.first_name, v.contact.last_name].filter(Boolean).join(" ")));
  const findVendor = (name: string) => {
    // AppFolio lists people as "Last, First"; Parcel Manage keeps first and last name.
    const person = /^[^,]+,\s*[^,]+$/.test(name) && !/,\s*(llc|inc|co|corp|ltd|pa|pllc|lp)\.?$/i.test(name);
    const n = norm(person ? name.split(",").reverse().join(" ") : name);
    const i = vendorNames.findIndex((v) => v === n || (n.length > 5 && (v.includes(n) || n.includes(v))));
    return i >= 0 ? vendorRows![i].id : null;
  };
  if (vendorFile) {
    for (const v of readVendorDirectory(readFileSync(vendorFile.path, "utf8"))) {
      const name = v.business_name ?? [v.first_name, v.last_name].filter(Boolean).join(" ");
      if (!findVendor(name)) needsPerson.push(`New vendor in AppFolio: ${name}. Add them in Vendors (with their W-9 and insurance).`);
    }
  }

  // ---------- open work orders ----------
  const woFile = newest("work_order");
  if (woFile) {
    const { data: existing } = await db.from("work_order").select("appfolio_ref").eq("company_id", cid).not("appfolio_ref", "is", null);
    const have = new Set((existing ?? []).map((w) => w.appfolio_ref));
    for (const r of csvRows(readFileSync(woFile.path, "utf8"))) {
      const ref = r["Work Order Number"];
      if (!ref || r.Property.startsWith("->") || have.has(ref)) continue;
      if (/completed|canceled|cancelled|work done/i.test(r.Status)) continue;
      const propName = r.Property.split(" - ")[0].trim();
      const prop = byProperty.get(propName);
      if (!prop) {
        needsPerson.push(`AppFolio work order ${ref} is for ${propName}, which isn't in Parcel Manage.`);
        continue;
      }
      const unit = r.Unit ? prop.unit.find((u) => u.label === r.Unit) : prop.unit.length === 1 ? prop.unit[0] : null;
      const vendorId = r.Vendor ? findVendor(r.Vendor) : null;
      const issue = r["Work Order Issue"] || r["Job Description"].split(/[.!\n]/)[0];
      const title = (issue || "Work order").slice(0, 120);
      const created = usDate(r["Created At"]);
      const where = `${propName}${unit && unit.label !== "Home" ? ` ${unit.label}` : ""}`;
      await apply(`Work order (AppFolio ${ref}) at ${where}: ${title}${r.Vendor ? ` · ${r.Vendor}${vendorId ? "" : " (not matched to a vendor; assign one)"}` : ""}`, async () => {
        const { data: wo, error } = await db
          .from("work_order")
          .insert({
            company_id: cid,
            property_id: prop.id,
            unit_id: unit?.id ?? null,
            source: "appfolio",
            appfolio_ref: ref,
            title,
            ai_summary: [r["Job Description"], r.Instructions ? `Instructions: ${r.Instructions}` : ""].filter(Boolean).join("\n\n") || title,
            priority: /urgent|high/i.test(r.Priority) ? "urgent" : /emergency/i.test(r.Priority) ? "emergency" : "routine",
            status: vendorId ? "assigned" : "new",
            vendor_id: vendorId,
            ...(created ? { created_at: `${created}T12:00:00Z` } : {}),
          })
          .select("id")
          .single();
        if (error || !wo) return { error: error ?? { message: "not saved" } };
        return db.from("work_order_event").insert({ company_id: cid, work_order_id: wo.id, kind: "created", detail: { source: `AppFolio work order ${ref} (${r.Status})` } });
      });
    }
  }

  console.log(changes.length ? `${commit ? "Updated" : "Will update"} (${changes.length}):\n  ${changes.join("\n  ")}` : "Nothing to update: Parcel Manage matches AppFolio.");
  if (needsPerson.length) console.log(`\nNeeds a person (${needsPerson.length}):\n  ${needsPerson.join("\n  ")}`);
  if (commit) console.log(`\nDone: ${applied} change${applied === 1 ? "" : "s"} saved.`);
  else if (changes.length) console.log("\nRun again with --commit to apply.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
