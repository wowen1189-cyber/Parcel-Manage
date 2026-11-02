import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { samePerson, sameBusiness } from "./appfolio";
import { sameName, type Normalized, type OwnerRow, type RentRollRow, type TenantRow, type VendorRow } from "./generic";

// Writes records from the Import data screen (lib/import/generic.ts) with the signed-in person's client, so
// Row Level Security keeps everything inside their company. With commit=false nothing is written and the
// result says what would happen. Safe to run twice: properties, units, vendors and owners already on file
// are matched by name and skipped (or filled in), never duplicated.

type Db = SupabaseClient<Database>;
export type ImportResult = { done: string[]; skipped: string[]; problems: string[] };

/** Placeholder owner for properties whose owner isn't known yet (same name the AppFolio import used). */
const UNASSIGNED_OWNER = "Owner LLC not set yet";
const CHUNK = 400;

async function insertAll<T extends keyof Database["public"]["Tables"]>(db: Db, table: T, rows: Database["public"]["Tables"][T]["Insert"][]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic over tables; each caller passes that table's Insert rows
    const { error } = await (db.from(table) as any).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${String(table)}: ${error.message}`);
  }
}

const n = (c: number, one: string, many = `${one}s`) => `${c} ${c === 1 ? one : many}`;

function monthsBetween(start: string, end: string | null) {
  if (!end) return null;
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / (1000 * 60 * 60 * 24 * 30.44)));
}

export async function saveImport(db: Db, companyId: string, data: Normalized, opts: { commit: boolean; asOf: string }): Promise<ImportResult> {
  if (data.kind === "rent_roll") return saveRentRoll(db, companyId, data.records, opts);
  if (data.kind === "tenants") return saveTenantContacts(db, companyId, data.records, opts.commit);
  if (data.kind === "vendors") return saveVendors(db, companyId, data.records, opts.commit);
  return saveOwners(db, companyId, data.records, opts.commit);
}

async function saveRentRoll(db: Db, cid: string, rows: RentRollRow[], { commit, asOf }: { commit: boolean; asOf: string }): Promise<ImportResult> {
  const out: ImportResult = { done: [], skipped: [], problems: [] };
  const [{ data: props, error: pe }, { data: units, error: ue }, { data: entities, error: ee }] = await Promise.all([
    db.from("property").select("id, name, address_line1").eq("company_id", cid),
    db.from("unit").select("id, label, property_id").eq("company_id", cid),
    db.from("entity").select("id, name").eq("company_id", cid),
  ]);
  if (pe || ue || ee) throw new Error((pe ?? ue ?? ee)!.message);

  const newEntities: Database["public"]["Tables"]["entity"]["Insert"][] = [];
  const entityFor = (owner: string | null) => {
    const name = owner || UNASSIGNED_OWNER;
    const found = [...(entities ?? []), ...newEntities].find((e) => sameBusiness(e.name, name) || e.name.toLowerCase() === name.toLowerCase());
    if (found) return found.id!;
    const id = crypto.randomUUID();
    newEntities.push({ id, company_id: cid, name, entity_type: /\bllc\b/i.test(name) ? "LLC" : null });
    return id;
  };

  // Group rows by property; the first spelling of a property wins.
  const groups: { name: string; rows: RentRollRow[] }[] = [];
  const seenUnits = new Set<string>();
  for (const r of rows) {
    const key = `${r.property.toLowerCase()}|${r.unit.toLowerCase()}`;
    if (seenUnits.has(key)) continue;
    seenUnits.add(key);
    const g = groups.find((x) => sameName(x.name, r.property));
    if (g) g.rows.push(r);
    else groups.push({ name: r.property, rows: [r] });
  }

  const newProps: Database["public"]["Tables"]["property"]["Insert"][] = [];
  const newUnits: Database["public"]["Tables"]["unit"]["Insert"][] = [];
  const newLeases: Database["public"]["Tables"]["lease"]["Insert"][] = [];
  const newContacts: Database["public"]["Tables"]["contact"]["Insert"][] = [];
  const links: Database["public"]["Tables"]["lease_tenant"]["Insert"][] = [];
  let existingProps = 0;
  let existingUnits = 0;
  let balances = 0;
  let deposits = 0;

  for (const g of groups) {
    const first = g.rows[0];
    const existing = (props ?? []).find((p) => sameName(p.name, g.name) || (p.address_line1 && first.address.address_line1 && sameName(p.address_line1, first.address.address_line1)));
    let propertyId = existing?.id;
    if (existing) existingProps++;
    else {
      propertyId = crypto.randomUUID();
      const kinds = new Set(g.rows.map((r) => r.kind));
      const kind = kinds.size > 1 ? "mixed" : first.kind;
      const single = g.rows.length === 1 && kind === "residential" && /^(home|house|main|1|)$/i.test(first.unit);
      newProps.push({
        id: propertyId,
        company_id: cid,
        entity_id: entityFor(first.owner),
        name: g.name,
        kind,
        property_type: kind === "mixed" ? "mixed_use" : kind === "commercial" ? "commercial" : single ? "single_family" : "multi_family",
        ...first.address,
      });
    }
    for (const r of g.rows) {
      if (existing && (units ?? []).some((u) => u.property_id === existing.id && u.label.toLowerCase() === r.unit.toLowerCase())) {
        existingUnits++;
        continue;
      }
      const unitId = crypto.randomUUID();
      const notice = Boolean(r.tenant && r.move_out_on && r.move_out_on >= asOf);
      newUnits.push({
        id: unitId,
        company_id: cid,
        property_id: propertyId!,
        label: r.unit,
        kind: r.kind,
        beds: r.kind === "commercial" ? null : r.beds,
        baths: r.kind === "commercial" ? null : r.baths,
        sqft: r.sqft == null ? null : Math.round(r.sqft),
        market_rent_cents: r.market_rent_cents,
        status: r.tenant ? (notice ? "notice" : "occupied") : "vacant",
      });
      if (!r.tenant) continue;
      const leaseId = crypto.randomUUID();
      const contactId = crypto.randomUUID();
      const start = r.start_date ?? r.move_in_on ?? asOf;
      const monthToMonth = Boolean(r.end_date && r.end_date < asOf);
      newLeases.push({
        id: leaseId,
        company_id: cid,
        unit_id: unitId,
        start_date: start,
        end_date: monthToMonth ? null : r.end_date,
        term_months: monthsBetween(start, r.end_date),
        rent_cents: Math.max(0, r.rent_cents),
        deposit_cents: Math.max(0, r.deposit_cents),
        status: notice ? "notice" : "active",
        move_in_on: r.move_in_on,
        move_out_on: r.move_out_on,
        opening_balance_cents: r.balance_cents,
        opening_balance_as_of: asOf,
        notes: monthToMonth ? `Month-to-month since the lease ended ${r.end_date}.` : null,
      });
      newContacts.push({ id: contactId, company_id: cid, kind: r.tenant.kind, business_name: r.tenant.business_name, first_name: r.tenant.first_name, last_name: r.tenant.last_name, email: r.tenant.email, phone: r.tenant.phone });
      links.push({ company_id: cid, lease_id: leaseId, contact_id: contactId, is_primary: true, role: "tenant" });
      if (r.balance_cents) balances++;
      if (r.deposit_cents > 0) deposits++;
    }
  }

  if (commit) {
    try {
      await insertAll(db, "entity", newEntities);
      await insertAll(db, "property", newProps);
      await insertAll(db, "unit", newUnits);
      await insertAll(db, "contact", newContacts);
      await insertAll(db, "lease", newLeases);
      await insertAll(db, "lease_tenant", links);
    } catch (e) {
      // All or nothing: remove what this run added, so running it again starts clean.
      const ids = (rows: { id?: string }[]) => rows.map((r) => r.id!);
      for (let i = 0; i < newLeases.length; i += CHUNK) await db.from("lease_tenant").delete().in("lease_id", ids(newLeases.slice(i, i + CHUNK)));
      for (const [table, list] of [["lease", newLeases], ["contact", newContacts], ["unit", newUnits], ["property", newProps], ["entity", newEntities]] as const) {
        for (let i = 0; i < list.length; i += CHUNK) await db.from(table).delete().in("id", ids(list.slice(i, i + CHUNK)));
      }
      throw e;
    }
  }
  const verb = commit ? "Added" : "Will add";
  out.done.push(`${verb} ${n(newProps.length, "property", "properties")}, ${n(newUnits.length, "unit")} and ${n(newLeases.length, "lease")} with their tenants.`);
  if (newLeases.length) out.done.push(`${n(balances, "balance")} and ${n(deposits, "deposit")} saved on the leases as of ${asOf}. Post them to the books in Settings › Billing › Switch over.`);
  const named = newEntities.filter((e) => e.name !== UNASSIGNED_OWNER);
  if (named.length) out.done.push(`${commit ? "Added" : "Will add"} ${n(named.length, "owner")}: ${named.map((e) => e.name).join(", ")}.`);
  if (newEntities.some((e) => e.name === UNASSIGNED_OWNER) || newProps.some((p) => (entities ?? []).find((e) => e.id === p.entity_id)?.name === UNASSIGNED_OWNER)) {
    out.problems.push(`Some properties have no owner in the file; they go under "${UNASSIGNED_OWNER}". Import Owners next, or set each owner on the Owners page.`);
  }
  if (existingProps) out.skipped.push(`${n(existingProps, "property", "properties")} already on file; only new units were added to them.`);
  if (existingUnits) out.skipped.push(`${n(existingUnits, "unit")} already on file, left as they are.`);
  return out;
}

async function saveTenantContacts(db: Db, cid: string, rows: TenantRow[], commit: boolean): Promise<ImportResult> {
  const out: ImportResult = { done: [], skipped: [], problems: [] };
  const { data, error } = await db
    .from("lease_tenant")
    .select("contact(id, first_name, last_name, business_name, email, phone, mobile), lease!inner(status, unit(label, property(name)))")
    .eq("company_id", cid)
    .in("lease.status", ["active", "notice", "pending_signature"]);
  if (error) throw new Error(error.message);
  let updated = 0;
  let nothingNew = 0;
  const notFound: string[] = [];
  const unclear: string[] = [];
  for (const r of rows) {
    let matches = (data ?? []).filter((t) => (t.contact.business_name ? sameBusiness(t.contact.business_name, r.name.full) : samePerson(t.contact, r.name)));
    if (matches.length > 1 && r.property) matches = matches.filter((t) => sameName(t.lease.unit.property.name, r.property!));
    if (matches.length > 1 && r.unit) matches = matches.filter((t) => t.lease.unit.label.toLowerCase() === r.unit!.toLowerCase());
    const ids = [...new Set(matches.map((m) => m.contact.id))];
    if (!ids.length) {
      notFound.push(`row ${r.row} (${r.name.full})`);
      continue;
    }
    if (ids.length > 1) {
      unclear.push(`row ${r.row} (${r.name.full})`);
      continue;
    }
    const c = matches[0].contact;
    const patch: { email?: string; phone?: string; mobile?: string } = {};
    if (r.email && !c.email) patch.email = r.email;
    if (r.phone && !c.phone) patch.phone = r.phone;
    if (r.mobile && !c.mobile) patch.mobile = r.mobile;
    if (!Object.keys(patch).length) {
      nothingNew++;
      continue;
    }
    if (commit) {
      const { error: e } = await db.from("contact").update(patch).eq("id", c.id);
      if (e) {
        out.problems.push(`Row ${r.row}: ${e.message}`);
        continue;
      }
    }
    updated++;
  }
  out.done.push(`${commit ? "Filled in" : "Will fill in"} contact details for ${n(updated, "tenant")}.`);
  if (nothingNew) out.skipped.push(`${n(nothingNew, "tenant")} already had these details.`);
  if (notFound.length) out.problems.push(`No current tenant by this name (import the rent roll first?): ${notFound.slice(0, 10).join(", ")}${notFound.length > 10 ? ` and ${notFound.length - 10} more` : ""}.`);
  if (unclear.length) out.problems.push(`More than one tenant by this name; add Property and Unit columns to tell them apart: ${unclear.slice(0, 10).join(", ")}.`);
  return out;
}

async function saveVendors(db: Db, cid: string, rows: VendorRow[], commit: boolean): Promise<ImportResult> {
  const out: ImportResult = { done: [], skipped: [], problems: [] };
  const { data, error } = await db.from("vendor").select("contact(business_name, first_name, last_name)").eq("company_id", cid);
  if (error) throw new Error(error.message);
  const contacts: Database["public"]["Tables"]["contact"]["Insert"][] = [];
  const vendors: Database["public"]["Tables"]["vendor"]["Insert"][] = [];
  const known = (data ?? []).map((v) => v.contact);
  let existing = 0;
  for (const r of rows) {
    const same = (c: { business_name: string | null; first_name: string | null; last_name: string | null }) =>
      r.business_name ? sameBusiness(c.business_name, r.business_name) : !c.business_name && samePerson(c, r);
    if (known.some(same)) {
      existing++;
      continue;
    }
    const id = crypto.randomUUID();
    known.push({ business_name: r.business_name, first_name: r.first_name, last_name: r.last_name });
    contacts.push({ id, company_id: cid, kind: r.kind, business_name: r.business_name, first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone, mobile: r.mobile, ...r.address, notes: r.contact_person ? `Contact: ${r.contact_person}` : null });
    vendors.push({ company_id: cid, contact_id: id, trade: r.trade, is_1099: r.is_1099, coi_expires_on: r.coi_expires_on, workers_comp_expires_on: r.workers_comp_expires_on, license_expires_on: r.license_expires_on, notes: r.notes });
  }
  if (commit) {
    try {
      await insertAll(db, "contact", contacts);
      await insertAll(db, "vendor", vendors);
    } catch (e) {
      for (let i = 0; i < contacts.length; i += CHUNK) {
        const ids = contacts.slice(i, i + CHUNK).map((c) => c.id!);
        await db.from("vendor").delete().in("contact_id", ids);
        await db.from("contact").delete().in("id", ids);
      }
      throw e;
    }
  }
  out.done.push(`${commit ? "Added" : "Will add"} ${n(vendors.length, "vendor")}. Each needs a W-9 on file before it's paid or sent to a unit.`);
  if (existing) out.skipped.push(`${n(existing, "vendor")} already on file.`);
  return out;
}

async function saveOwners(db: Db, cid: string, rows: OwnerRow[], commit: boolean): Promise<ImportResult> {
  const out: ImportResult = { done: [], skipped: [], problems: [] };
  const [{ data: entities, error: ee }, { data: props, error: pe }] = await Promise.all([
    db.from("entity").select("id, name, email, phone, mailing_address, tax_id_last4").eq("company_id", cid),
    db.from("property").select("id, name, address_line1, entity_id").eq("company_id", cid),
  ]);
  if (ee || pe) throw new Error((ee ?? pe)!.message);
  const unassigned = (entities ?? []).find((e) => e.name === UNASSIGNED_OWNER)?.id;
  const inserts: Database["public"]["Tables"]["entity"]["Insert"][] = [];
  let filled = 0;
  const moves: { id: string; name: string; entity: string }[] = [];
  const notFound: string[] = [];
  const conflicts: string[] = [];
  for (const r of rows) {
    const found = (entities ?? []).find((e) => sameBusiness(e.name, r.name) || e.name.toLowerCase() === r.name.toLowerCase());
    let id = found?.id;
    if (!found) {
      id = crypto.randomUUID();
      inserts.push({ id, company_id: cid, name: r.name, entity_type: r.entity_type, email: r.email, phone: r.phone, mailing_address: r.mailing_address, tax_id_last4: r.tax_id_last4 });
    } else {
      const patch = {
        ...(r.email && !found.email ? { email: r.email } : {}),
        ...(r.phone && !found.phone ? { phone: r.phone } : {}),
        ...(r.mailing_address && !found.mailing_address ? { mailing_address: r.mailing_address } : {}),
        ...(r.tax_id_last4 && !found.tax_id_last4 ? { tax_id_last4: r.tax_id_last4 } : {}),
      };
      if (Object.keys(patch).length) {
        filled++;
        if (commit) {
          const { error } = await db.from("entity").update(patch).eq("id", found.id);
          if (error) out.problems.push(`${r.name}: ${error.message}`);
        }
      }
    }
    for (const name of r.properties) {
      const p = (props ?? []).find((x) => sameName(x.name, name) || (x.address_line1 && sameName(x.address_line1, name)));
      if (!p) {
        notFound.push(name);
        continue;
      }
      if (p.entity_id === id || moves.some((m) => m.id === p.id)) continue;
      // Never move a property away from a real owner silently: only from the placeholder.
      if (p.entity_id !== unassigned) {
        conflicts.push(`${p.name} (already under another owner)`);
        continue;
      }
      moves.push({ id: p.id, name: p.name, entity: id! });
    }
  }
  if (commit) {
    await insertAll(db, "entity", inserts);
    for (const m of moves) {
      const { error } = await db.from("property").update({ entity_id: m.entity }).eq("id", m.id).eq("entity_id", unassigned!);
      if (error) out.problems.push(`${m.name}: ${error.message}`);
    }
  }
  out.done.push(`${commit ? "Added" : "Will add"} ${n(inserts.length, "owner")}${filled ? `, filled in details for ${n(filled, "owner")}` : ""}, and ${commit ? "put" : "will put"} ${n(moves.length, "property", "properties")} under their owner.`);
  if (rows.length - inserts.length) out.skipped.push(`${n(rows.length - inserts.length, "owner")} already on file.`);
  if (notFound.length) out.problems.push(`Properties not found (import the rent roll first?): ${notFound.slice(0, 10).join(", ")}.`);
  if (conflicts.length) out.problems.push(`Left alone: ${conflicts.slice(0, 10).join(", ")}. Change those on the property page if needed.`);
  return out;
}
