// Adds AppFolio Tenant Directory details to leases already imported from the rent roll:
// phones and emails, co-signers and occupants, late-fee terms, renters insurance, license plates, pets.
// Run: npm run import:tenants                (dry run: reports matches, changes nothing)
//      npm run import:tenants -- --commit
// Safe to run again: it fills empty contact fields only and skips vehicles, pets and policies already on file.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readTenantDirectory, sameBusiness, samePerson, type DirectoryTenant } from "../lib/import/appfolio.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");
const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const commit = process.argv.includes("--commit");
const FILE = process.env.TENANT_DIRECTORY ?? "imports/tenant_directory-20261101.csv";
const TODAY = "2026-11-01";

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data == null) throw new Error(`${label}: ${error?.message ?? "no data"}`);
  return data as NonNullable<T>;
}

const key = (property: string, unit: string) => `${property.toLowerCase()}|${unit.toLowerCase()}`;
const label = (t: DirectoryTenant) => t.business_name ?? [t.first_name, t.last_name].filter(Boolean).join(" ");

async function main() {
  const rows = readTenantDirectory(readFileSync(FILE, "utf8"));
  const company = await must("company", db.from("company").select("id").eq("subdomain", "simreipm").single());
  const cid = company.id;
  const leases = await must(
    "leases",
    db
      .from("lease")
      .select("id, start_date, status, unit!inner(label, property!inner(name)), lease_tenant(contact_id, role, is_primary, contact(id, kind, first_name, last_name, business_name, email, mobile, phone, notes))")
      .eq("company_id", cid)
      .in("status", ["active", "notice"]),
  );
  const byUnit = new Map(leases.map((l) => [key(l.unit.property.name, l.unit.label), l]));

  const skipped: string[] = [];
  const counts = { matched: 0, added: 0, contactUpdates: 0, leaseTerms: 0, insurance: 0, vehicles: 0, pets: 0 };
  const leaseTermsDone = new Set<string>();

  for (const t of rows) {
    if (t.status === "past") continue;
    const lease = byUnit.get(key(t.propertyName, t.unitLabel));
    if (!lease) {
      skipped.push(`${t.status}: ${label(t)} at ${t.propertyName} ${t.unitLabel}: no current lease for that unit`);
      continue;
    }
    if (t.status === "future" && t.leaseFrom && t.leaseFrom !== lease.start_date) {
      skipped.push(`upcoming lease: ${label(t)} at ${t.propertyName} ${t.unitLabel} from ${t.leaseFrom} (set up when it starts)`);
      continue;
    }

    // Who on the lease is this?
    // A commercial tenant is stored as the business; the directory row may be the person behind it.
    const existing = lease.lease_tenant.find(({ contact: c }) =>
      c.kind === "business"
        ? sameBusiness(c.business_name, t.business_name ?? t.company_name) || sameBusiness(c.business_name, `${t.first_name ?? ""} ${t.last_name ?? ""}`)
        : t.kind === "person" && samePerson(c, t),
    );
    const contactPerson = existing?.contact.kind === "business" && t.kind === "person" ? `Contact: ${[t.first_name, t.last_name].filter(Boolean).join(" ")}` : "";
    let contactId = existing?.contact.id;
    if (existing) {
      counts.matched++;
      const c = existing.contact;
      const fill: Partial<Database["public"]["Tables"]["contact"]["Update"]> = {};
      if (!c.email && t.email) fill.email = t.email;
      if (!c.mobile && t.mobile) fill.mobile = t.mobile;
      if (!c.phone && t.phone) fill.phone = t.phone;
      const extra = [contactPerson, t.phoneExtra.length ? `Other phones: ${t.phoneExtra.join(", ")}` : "", t.notes ?? ""].filter(Boolean).join("\n");
      if (extra && !(c.notes ?? "").includes(extra)) fill.notes = [c.notes, extra].filter(Boolean).join("\n");
      if (Object.keys(fill).length) {
        counts.contactUpdates++;
        if (commit) await must("contact update", db.from("contact").update(fill).eq("id", c.id).select("id"));
      }
      if (commit && (existing.role !== t.role || existing.is_primary !== t.isPrimary)) {
        await must("lease tenant", db.from("lease_tenant").update({ role: t.role, is_primary: t.isPrimary }).eq("lease_id", lease.id).eq("contact_id", c.id).select("lease_id"));
      }
    } else {
      counts.added++;
      if (process.argv.includes("--explain")) console.log(`  + ${t.role}${t.isPrimary ? " (primary)" : ""} at ${t.propertyName} ${t.unitLabel}; on the lease now: ${lease.lease_tenant.map((x) => x.contact.business_name ?? x.contact.last_name).join(", ")}`);
      if (commit) {
        const c = await must(
          "contact",
          db
            .from("contact")
            .insert({ company_id: cid, kind: t.kind, first_name: t.first_name, last_name: t.last_name, business_name: t.business_name, email: t.email, mobile: t.mobile, phone: t.phone, notes: t.notes })
            .select("id")
            .single(),
        );
        contactId = c.id;
        await must("lease tenant", db.from("lease_tenant").insert({ company_id: cid, lease_id: lease.id, contact_id: c.id, role: t.role, is_primary: t.isPrimary }).select("lease_id"));
      }
    }

    // Late-fee terms and payment rules are per lease; take them from the primary tenant's row.
    if ((t.isPrimary || !leaseTermsDone.has(lease.id)) && t.lease.late_fee_grace_days != null) {
      if (!leaseTermsDone.has(lease.id)) counts.leaseTerms++;
      leaseTermsDone.add(lease.id);
      if (commit) await must("lease terms", db.from("lease").update(t.lease).eq("id", lease.id).select("id"));
    }

    if (!contactId) continue; // dry run, new person
    if (t.insurance) {
      const have = await must("insurance", db.from("renters_insurance").select("id").eq("tenant_contact_id", contactId).eq("carrier", t.insurance.carrier));
      if (!have.length) {
        counts.insurance++;
        if (commit)
          await must(
            "insurance insert",
            db
              .from("renters_insurance")
              .insert({
                company_id: cid,
                tenant_contact_id: contactId,
                lease_id: lease.id,
                carrier: t.insurance.carrier,
                policy_number: t.insurance.policy_number,
                expires_on: t.insurance.expires_on,
                company_is_interested_party: t.insurance.companyIsInterestedParty,
                status: t.insurance.expires_on && t.insurance.expires_on < TODAY ? "expired" : "active",
                updated_source: "import",
              })
              .select("id"),
          );
      }
    }
    for (const plate of t.plates) {
      const have = await must("vehicles", db.from("vehicle").select("id").eq("lease_id", lease.id).eq("tag_number", plate));
      if (!have.length) {
        counts.vehicles++;
        if (commit) await must("vehicle", db.from("vehicle").insert({ company_id: cid, tenant_contact_id: contactId, lease_id: lease.id, tag_number: plate, updated_source: "import" }).select("id"));
      }
    }
    for (const pet of t.pets) {
      const q = db.from("pet").select("id").eq("lease_id", lease.id).eq("kind", pet.kind);
      const have = await must("pets", pet.name ? q.eq("name", pet.name) : q.is("name", null));
      if (!have.length) {
        counts.pets++;
        if (commit) await must("pet", db.from("pet").insert({ company_id: cid, lease_id: lease.id, kind: pet.kind, name: pet.name, updated_source: "import" }).select("id"));
      }
    }
  }

  console.log(`Tenant directory: ${rows.length} rows (${rows.filter((r) => r.status === "past").length} former tenants left out)`);
  console.log(`  Matched to people already on leases: ${counts.matched} (${counts.contactUpdates} get new contact details)`);
  console.log(`  New people added to leases (co-signers, occupants): ${counts.added}`);
  console.log(`  Leases getting late-fee and payment terms: ${counts.leaseTerms}`);
  console.log(`  Renters insurance policies: ${counts.insurance} · vehicles: ${counts.vehicles} · pets: ${counts.pets}`);
  if (skipped.length) console.log(`  Not imported:\n${skipped.map((s) => `    - ${s}`).join("\n")}`);
  console.log(commit ? "Done." : "\nDry run only. Add --commit to write.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
