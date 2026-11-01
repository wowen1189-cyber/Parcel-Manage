// Seeds SIM REI (company #1) with its team, entities, properties, units, owners and sample tenants.
// Run: npm run seed            (stops if SIM REI already exists)
//      npm run seed -- --reset (deletes SIM REI and everything under it, then seeds again)
// Addresses and LLC names marked "sample" are placeholders for Wesley to correct in the app.

import { createClient } from "@supabase/supabase-js";
import { DEFAULT_BUSINESS_RULES } from "../lib/business-rules.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");

const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const reset = process.argv.includes("--reset");

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data == null) throw new Error(`${label}: ${error?.message ?? "no data"}`);
  return data as NonNullable<T>;
}

async function findOrCreateUser(email: string, fullName: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw error;
  return data.user.id;
}

const FIRST = ["Maria", "James", "Aaliyah", "Robert", "Linda", "Carlos", "Tasha", "Michael", "Jennifer", "David", "Keisha", "Brian", "Ashley", "Luis", "Stephanie", "Kevin", "Brittany", "Anthony", "Nicole", "Marcus", "Rachel", "Derek", "Vanessa"];
const LAST = ["Hernandez", "Walker", "Brooks", "Nguyen", "Price", "Reyes", "Coleman", "Turner", "Bennett", "Foster", "Simmons", "Patel", "Howard", "Ramirez", "Morgan", "Hayes", "Ellis", "Jenkins", "Russell", "Gray", "Sullivan", "Ortiz", "Kim"];

async function main() {
  const existing = await db.from("company").select("id").eq("subdomain", "simreipm").maybeSingle();
  if (existing.data) {
    if (!reset) {
      console.log("SIM REI is already seeded. Run `npm run seed -- --reset` to start over.");
      return;
    }
    await must("delete SIM REI", db.from("company").delete().eq("id", existing.data.id).select("id"));
    console.log("Deleted the old SIM REI data.");
  }

  const company = await must(
    "company",
    db
      .from("company")
      .insert({
        name: "SIM REI Property Management",
        legal_name: "SIM REI Property Management",
        subdomain: "simreipm",
        time_zone: "America/New_York",
        office_phone: "(352) 715-6203",
        address: "432 N Eustis St, Eustis, FL 32726",
        default_county: "Lake",
        settings: { businessRules: DEFAULT_BUSINESS_RULES },
      })
      .select()
      .single(),
  );
  const cid = company.id;

  // Team: Wesley signs in with his own email (sign-in link or a password he sets).
  const wesleyId = await findOrCreateUser("wowen@simrei.com", "Wesley Owen");
  await must("profile", db.from("profile").update({ full_name: "Wesley Owen" }).eq("id", wesleyId).select("id"));
  await must(
    "membership",
    db.from("membership").insert({ company_id: cid, profile_id: wesleyId, role: "admin", title: "Broker | Owner" }).select("id"),
  );

  // Entities (sample names except the Grove Tower LLC).
  const [groveLlc, holdings] = await must(
    "entities",
    db
      .from("entity")
      .insert([
        { company_id: cid, name: "100 North Dewey St LLC", entity_type: "LLC" },
        { company_id: cid, name: "SIM REI Holdings LLC (sample)", entity_type: "LLC" },
      ])
      .select(),
  );

  // Owners
  const [wesley, daniel, rick] = await must(
    "owners",
    db
      .from("contact")
      .insert([
        { company_id: cid, kind: "person", first_name: "Wesley", last_name: "Owen", mobile: "(352) 434-9441", email: "wowen@simrei.com" },
        { company_id: cid, kind: "person", first_name: "Daniel", last_name: "DiVenanzo" },
        { company_id: cid, kind: "person", first_name: "Rick", last_name: "Nelson" },
      ])
      .select(),
  );

  type UnitSpec = { label: string; kind: "residential" | "commercial"; beds?: number; baths?: number; sqft?: number; rent: number; status: "occupied" | "vacant" | "notice" | "listed" };
  type PropertySpec = { name: string; kind: "residential" | "commercial" | "mixed"; address: string | null; entity: string; owners: [string, number][]; units: UnitSpec[] };

  const towerUnits: UnitSpec[] = [];
  for (const floor of [1, 2, 3, 4]) {
    for (const n of [1, 2, 3, 4, 5]) {
      const label = `${floor}0${n}`;
      const twoBed = n === 1 || n === 5;
      const status = label === "305" || label === "402" ? "vacant" : label === "204" ? "notice" : "occupied";
      towerUnits.push({ label, kind: "residential", beds: twoBed ? 2 : 1, baths: twoBed ? 2 : 1, sqft: twoBed ? 980 : 720, rent: twoBed ? 135000 : 119500, status });
    }
  }

  const properties: PropertySpec[] = [
    { name: "The Grove Tower", kind: "residential", address: "100 N Dewey St", entity: groveLlc.id, owners: [[wesley.id, 35], [daniel.id, 32.5], [rick.id, 32.5]], units: towerUnits },
    {
      name: "Grove Park",
      kind: "mixed",
      address: null,
      entity: holdings.id,
      owners: [[wesley.id, 100]],
      units: [
        { label: "Suite 101", kind: "commercial", sqft: 1400, rent: 210000, status: "occupied" },
        { label: "Suite 102", kind: "commercial", sqft: 1100, rent: 165000, status: "listed" },
        { label: "201", kind: "residential", beds: 2, baths: 1, sqft: 900, rent: 125000, status: "occupied" },
        { label: "202", kind: "residential", beds: 1, baths: 1, sqft: 650, rent: 110000, status: "occupied" },
      ],
    },
    { name: "420 S Palmetto", kind: "residential", address: "420 S Palmetto St", entity: holdings.id, owners: [[wesley.id, 100]], units: [{ label: "House", kind: "residential", beds: 3, baths: 2, sqft: 1450, rent: 165000, status: "listed" }] },
    { name: "1026 W Line St", kind: "residential", address: "1026 W Line St", entity: holdings.id, owners: [[wesley.id, 100]], units: [{ label: "House", kind: "residential", beds: 3, baths: 1, sqft: 1200, rent: 145000, status: "occupied" }] },
    { name: "6 Forest Lane", kind: "residential", address: "6 Forest Ln", entity: holdings.id, owners: [[wesley.id, 100]], units: [{ label: "House", kind: "residential", beds: 2, baths: 2, sqft: 1100, rent: 140000, status: "occupied" }] },
  ];

  let tenantIndex = 0;
  let occupiedCount = 0;
  for (const p of properties) {
    const property = await must(
      `property ${p.name}`,
      db
        .from("property")
        .insert({ company_id: cid, entity_id: p.entity, name: p.name, kind: p.kind, address_line1: p.address, city: "Eustis", state: "FL", postal_code: "32726", county: "Lake" })
        .select()
        .single(),
    );
    await must(
      `owners ${p.name}`,
      db.from("property_owner").insert(p.owners.map(([owner, pct]) => ({ company_id: cid, property_id: property.id, owner_contact_id: owner, ownership_pct: pct }))).select("id"),
    );

    for (const u of p.units) {
      const unit = await must(
        `unit ${p.name} ${u.label}`,
        db
          .from("unit")
          .insert({ company_id: cid, property_id: property.id, label: u.label, kind: u.kind, beds: u.beds ?? null, baths: u.baths ?? null, sqft: u.sqft ?? null, market_rent_cents: u.rent, status: u.status })
          .select()
          .single(),
      );
      if (u.status !== "occupied" && u.status !== "notice") continue;
      occupiedCount++;

      const i = tenantIndex++;
      const first = FIRST[i % FIRST.length];
      const last = LAST[(i * 7) % LAST.length];
      const tenant = await must(
        "tenant",
        db
          .from("contact")
          .insert(
            u.kind === "commercial"
              ? { company_id: cid, kind: "business", business_name: "Lakeside Family Dental (sample)", email: "office@lakeside-dental.example.com", phone: "(352) 555-0190" }
              : {
                  company_id: cid,
                  kind: "person",
                  first_name: first,
                  last_name: last,
                  email: `${first}.${last}@example.com`.toLowerCase(),
                  mobile: `(352) 555-${String(100 + i).padStart(4, "0")}`,
                  preferred_contact: i % 3 === 0 ? "email" : "text",
                  sms_opt_in: i % 3 !== 0,
                  sms_opt_in_at: i % 3 !== 0 ? new Date().toISOString() : null,
                },
          )
          .select()
          .single(),
      );
      const startMonth = (i % 10) + 1;
      const start = `2026-${String(startMonth).padStart(2, "0")}-01`;
      const end = `2027-${String(startMonth).padStart(2, "0")}-01`;
      const lease = await must(
        "lease",
        db
          .from("lease")
          .insert({ company_id: cid, unit_id: unit.id, start_date: start, end_date: end, term_months: 12, rent_cents: u.rent, deposit_cents: u.rent, status: u.status === "notice" ? "notice" : "active", autopay: i % 2 === 0 })
          .select()
          .single(),
      );
      await must("lease tenant", db.from("lease_tenant").insert({ company_id: cid, lease_id: lease.id, contact_id: tenant.id, is_primary: true }).select("lease_id"));

      if (u.kind === "residential" && i % 2 === 0) {
        await must(
          "emergency contact",
          db.from("emergency_contact").insert({ company_id: cid, tenant_contact_id: tenant.id, name: `${FIRST[(i + 5) % FIRST.length]} ${last}`, relationship: "Sibling", phone: `(352) 555-${String(300 + i).padStart(4, "0")}` }).select("id"),
        );
        await must(
          "vehicle",
          db.from("vehicle").insert({ company_id: cid, tenant_contact_id: tenant.id, lease_id: lease.id, make_model: ["2019 Toyota Camry", "2021 Honda CR-V", "2017 Ford F-150", "2022 Hyundai Elantra"][i % 4], color: ["Silver", "Blue", "Black", "White"][i % 4], tag_number: `Q${String(41 + i)}ZPM`, tag_state: "FL", parking_permit_number: p.name === "The Grove Tower" ? `GT-${String(i + 1).padStart(3, "0")}` : null }).select("id"),
        );
      }
    }
  }

  console.log(`Seeded SIM REI: ${properties.length} properties, ${tenantIndex} tenants on ${occupiedCount} leased units.`);
  console.log(`Wesley Owen (wowen@simrei.com) is the admin. Sign in at simreipm.<root domain> with "Email me a link".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
