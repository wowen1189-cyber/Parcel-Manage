// Imports SIM REI's AppFolio rent roll and vendor directory, replacing the made-up sample portfolio.
// Run: npm run import:appfolio                      (dry run: reads the files and reports, changes nothing)
//      npm run import:appfolio -- --commit          (writes; refuses if real records already exist)
//      npm run import:appfolio -- --commit --replace (deletes properties, tenants, leases and vendors first)
// Files are read from imports/ (git-ignored: they hold tenant details and door codes).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readRentRoll, readVendorDirectory, personName, type RentRollLease } from "../lib/import/appfolio.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const commit = process.argv.includes("--commit");
const replace = process.argv.includes("--replace");
const ROLL = process.env.RENT_ROLL ?? "imports/rent_roll-20261101.csv";
const VENDORS = process.env.VENDOR_DIRECTORY ?? "imports/vendor_directory-20261101.csv";
const AS_OF = "2026-11-01"; // date of the AppFolio export
const GROVE_TOWER_LLC = "100 North Dewey St LLC";
const OWNER_NOT_SET = "Owner LLC not set yet";

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data == null) throw new Error(`${label}: ${error?.message ?? "no data"}`);
  return data as NonNullable<T>;
}

const money = (c: number | null) => (c == null ? "-" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);

function monthsBetween(start: string, end: string | null) {
  if (!end) return null;
  const [a, b] = [new Date(start), new Date(end)];
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

async function main() {
  const properties = readRentRoll(readFileSync(ROLL, "utf8"));
  const vendors = readVendorDirectory(readFileSync(VENDORS, "utf8"));

  // ---------- report ----------
  const units = properties.flatMap((p) => p.units);
  const leases = units.flatMap((u) => (u.lease ? [u.lease] : []));
  console.log(`Rent roll: ${properties.length} properties, ${units.length} units, ${leases.length} leases`);
  for (const p of properties) {
    console.log(`  ${p.name} (${p.property_type}, ${[p.address.address_line1, p.address.city].join(", ")}): ${p.units.length} units`);
  }
  console.log(`  Monthly rent ${money(leases.reduce((s, l) => s + l.rent_cents, 0))} · deposits held ${money(leases.reduce((s, l) => s + l.deposit_cents, 0))} · past due ${money(leases.reduce((s, l) => s + (l.past_due_cents ?? 0), 0))}`);
  console.log(`  Co-tenants: ${leases.reduce((s, l) => s + l.additionalTenants.length, 0)} · leases with their own late fee: ${leases.filter((l) => l.lateFee).length} · door codes: ${units.filter((u) => u.access_notes.length).length}`);
  const flags: string[] = [];
  for (const p of properties) {
    for (const u of p.units) {
      const l = u.lease;
      if (!l) continue;
      const where = `${p.name} ${u.label}`;
      if (l.month_to_month) flags.push(`${where}: lease ended, now month-to-month`);
      if (l.rent_cents === 0) flags.push(`${where}: $0 rent (${l.tenant})`);
      if (l.end_date && l.end_date < AS_OF) flags.push(`${where}: lease end ${l.end_date} is in the past`);
      if (u.kind === "residential" && l.deposit_cents === 0 && l.deposit_pending_cents === 0) flags.push(`${where}: no security deposit on record`);
    }
  }
  console.log(`  Flags (${flags.length}):`);
  for (const f of flags) console.log(`    - ${f}`);
  console.log(`Vendors: ${vendors.length} (${vendors.filter((v) => v.kind === "person").length} people)`);
  const byTrade = new Map<string, number>();
  for (const v of vendors) byTrade.set(v.trade, (byTrade.get(v.trade) ?? 0) + 1);
  console.log(`  ${[...byTrade].map(([t, n]) => `${t} ${n}`).join(" · ")}`);
  console.log(`  With insurance dates: ${vendors.filter((v) => v.coi_expires_on).length}`);

  if (!commit) {
    console.log("\nDry run only. Add --commit to write.");
    return;
  }

  // ---------- write ----------
  const company = await must("company", db.from("company").select("id").eq("subdomain", "simreipm").single());
  const cid = company.id;

  const existing = await must("properties", db.from("property").select("id").eq("company_id", cid));
  if (existing.length && !replace) throw new Error(`SIM REI already has ${existing.length} properties. Add --replace to delete them (and their units, leases, tenants and vendors) first.`);
  if (existing.length) {
    const workOrders = await must("work orders", db.from("work_order").select("id").eq("company_id", cid).limit(1));
    const charges = await must("charges", db.from("charge").select("id").eq("company_id", cid).limit(1));
    if (workOrders.length || charges.length) throw new Error("SIM REI has work orders or charges. Replacing would lose real history, so stopping.");
    const leaseIds = (await must("leases", db.from("lease").select("id").eq("company_id", cid))).map((l) => l.id);
    if (leaseIds.length) await must("lease tenants", db.from("lease_tenant").delete().in("lease_id", leaseIds).select("lease_id"));
    await must("vehicles", db.from("vehicle").delete().eq("company_id", cid).select("id"));
    await must("emergency contacts", db.from("emergency_contact").delete().eq("company_id", cid).select("id"));
    await must("renters insurance", db.from("renters_insurance").delete().eq("company_id", cid).select("id"));
    await must("leases", db.from("lease").delete().eq("company_id", cid).select("id"));
    await must("units", db.from("unit").delete().eq("company_id", cid).select("id"));
    await must("property owners", db.from("property_owner").delete().eq("company_id", cid).select("id"));
    await must("properties", db.from("property").delete().eq("company_id", cid).select("id"));
    await must("vendors", db.from("vendor").delete().eq("company_id", cid).select("id"));
    // Keep the owner contacts (people with an ownership stake are re-linked below); delete every other contact.
    const owners = await must("owner contacts", db.from("contact").select("id, first_name, last_name").eq("company_id", cid));
    const keep = new Set(owners.filter((c) => ["Wesley Owen", "Daniel DiVenanzo", "Rick Nelson"].includes(`${c.first_name} ${c.last_name}`)).map((c) => c.id));
    const drop = owners.filter((c) => !keep.has(c.id)).map((c) => c.id);
    for (let i = 0; i < drop.length; i += 100) await must("contacts", db.from("contact").delete().in("id", drop.slice(i, i + 100)).select("id"));
    await must("entities", db.from("entity").delete().eq("company_id", cid).neq("name", GROVE_TOWER_LLC).select("id"));
    console.log("Deleted the previous portfolio.");
  }

  // Entities and owners. The Grove Tower's LLC and split are known; the rest are set in the app.
  const entities = await must("entities", db.from("entity").select("id, name").eq("company_id", cid));
  const groveLlc = entities.find((e) => e.name === GROVE_TOWER_LLC) ?? (await must("entity", db.from("entity").insert({ company_id: cid, name: GROVE_TOWER_LLC, entity_type: "LLC" }).select().single()));
  const notSet = await must("entity", db.from("entity").insert({ company_id: cid, name: OWNER_NOT_SET }).select().single());
  const ownerContacts = await must("owners", db.from("contact").select("id, first_name, last_name").eq("company_id", cid));
  const owner = (full: string) => ownerContacts.find((c) => `${c.first_name} ${c.last_name}` === full)?.id;
  const groveSplit: [string | undefined, number][] = [[owner("Wesley Owen"), 35], [owner("Daniel DiVenanzo"), 32.5], [owner("Rick Nelson"), 32.5]];

  const contact = async (name: string, business: boolean, tags: string[] = []) => {
    const fields = business ? { kind: "business", business_name: name } : { kind: "person", ...personName(name) };
    return must("contact", db.from("contact").insert({ company_id: cid, ...fields, tags }).select("id").single());
  };

  let leaseCount = 0;
  for (const p of properties) {
    const isTower = p.name === "The Grove Tower";
    const property = await must(
      `property ${p.name}`,
      db
        .from("property")
        .insert({
          company_id: cid,
          entity_id: isTower ? groveLlc.id : notSet.id,
          name: p.name,
          kind: p.kind,
          property_type: p.property_type,
          ...p.address,
          county: "Lake",
          amenities: [...new Set(p.units.flatMap((u) => (p.property_type === "single_family" ? u.amenities : [])))],
        })
        .select("id")
        .single(),
    );
    if (isTower) {
      await must("tower owners", db.from("property_owner").insert(groveSplit.filter(([id]) => id).map(([id, pct]) => ({ company_id: cid, property_id: property.id, owner_contact_id: id!, ownership_pct: pct }))).select("id"));
    }

    for (const u of p.units) {
      const unit = await must(
        `unit ${p.name} ${u.label}`,
        db
          .from("unit")
          .insert({
            company_id: cid,
            property_id: property.id,
            label: u.label,
            kind: u.kind,
            beds: u.beds,
            baths: u.baths,
            sqft: u.sqft,
            market_rent_cents: u.market_rent_cents,
            status: u.status,
            amenities: p.property_type === "single_family" ? [] : u.amenities,
            access_notes: u.access_notes.join("\n") || null,
          })
          .select("id")
          .single(),
      );
      if (u.lease) {
        await importLease(cid, unit.id, u.lease, contact);
        leaseCount++;
      }
    }
  }

  for (const v of vendors) {
    const c = await must(
      `vendor contact ${v.business_name ?? v.last_name}`,
      db
        .from("contact")
        .insert({
          company_id: cid,
          kind: v.kind,
          business_name: v.business_name,
          first_name: v.first_name,
          last_name: v.last_name,
          email: v.email,
          phone: v.phone,
          mobile: v.mobile,
          ...v.address,
          notes: v.contactPerson ? `Contact: ${v.contactPerson}` : null,
        })
        .select("id")
        .single(),
    );
    await must(
      "vendor",
      db
        .from("vendor")
        .insert({
          company_id: cid,
          contact_id: c.id,
          trade: v.trade,
          is_1099: v.is_1099,
          payment_method: v.payment_method,
          coi_expires_on: v.coi_expires_on,
          workers_comp_expires_on: v.workers_comp_expires_on,
          auto_insurance_expires_on: v.auto_insurance_expires_on,
          license_expires_on: v.license_expires_on,
          epa_cert_expires_on: v.epa_cert_expires_on,
          contract_expires_on: v.contract_expires_on,
          last_paid_on: v.last_paid_on,
          notes: v.notes.join("\n") || null,
        })
        .select("id"),
    );
  }

  console.log(`Imported ${properties.length} properties, ${units.length} units, ${leaseCount} leases and ${vendors.length} vendors.`);
}

async function importLease(
  cid: string,
  unitId: string,
  l: RentRollLease,
  contact: (name: string, business: boolean, tags?: string[]) => Promise<{ id: string }>,
) {
  const lease = await must(
    "lease",
    db
      .from("lease")
      .insert({
        company_id: cid,
        unit_id: unitId,
        start_date: l.start_date,
        end_date: l.end_date,
        term_months: monthsBetween(l.start_date, l.end_date),
        rent_cents: l.rent_cents,
        deposit_cents: l.deposit_cents,
        deposit_pending_cents: l.deposit_pending_cents,
        status: l.status,
        move_in_on: l.move_in_on,
        move_out_on: l.move_out_on,
        late_fee_grace_days: l.lateFee?.late_fee_grace_days ?? null,
        late_fee_flat_cents: l.lateFee?.late_fee_flat_cents ?? null,
        late_fee_pct: l.lateFee?.late_fee_pct ?? null,
        next_rent_increase_on: l.next_rent_increase_on,
        next_rent_cents: l.next_rent_cents,
        notes: l.notes.join("\n") || null,
        opening_balance_cents: l.past_due_cents,
        opening_balance_as_of: AS_OF,
      })
      .select("id")
      .single(),
  );
  const primary = await contact(l.tenant, l.tenantIsBusiness, l.contactTags);
  const links = [{ lease_id: lease.id, contact_id: primary.id, is_primary: true, company_id: cid, role: "tenant" }];
  for (const name of l.additionalTenants) {
    const co = await contact(name, false);
    links.push({ lease_id: lease.id, contact_id: co.id, is_primary: false, company_id: cid, role: "tenant" });
  }
  await must("lease tenants", db.from("lease_tenant").insert(links).select("lease_id"));
  if (l.other_monthly_charges_cents && l.other_monthly_charges_cents > 0) {
    await must(
      "recurring charge",
      db
        .from("recurring_charge")
        .insert({ company_id: cid, lease_id: lease.id, description: "Other monthly charges (total from AppFolio; split into items)", amount_cents: l.other_monthly_charges_cents })
        .select("id"),
    );
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
