// Imports the AppFolio Owner Directory: each owning LLC or corporation becomes an owner with its
// contact details and its properties put under it; individual partners (shares of a co-owned building)
// get their phone, e-mail and mailing address on their contact.
// Run: npm run import:owners                (dry run: reports what it would do, changes nothing)
//      npm run import:owners -- --commit
// OWNER_EMAIL_REWRITE="old@x.com=new@y.com" (in .env.local) replaces an address that must not be used.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readOwnerDirectory, sameProperty } from "../lib/import/appfolio.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");
const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const commit = process.argv.includes("--commit");
const FILE = process.env.OWNER_DIRECTORY ?? "imports/owner_directory-20261101.csv";
const UNASSIGNED = "Owner LLC not set yet";
const rewrites = new Map(
  (process.env.OWNER_EMAIL_REWRITE ?? "")
    .split(",")
    .map((p) => p.split("=").map((s) => s.trim().toLowerCase()))
    .filter((p) => p.length === 2 && p[0]) as [string, string][],
);
const emailsOf = (list: string[]) => [...new Set(list.map((e) => rewrites.get(e.toLowerCase()) ?? e.toLowerCase()))];

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data == null) throw new Error(`${label}: ${error?.message ?? "no data"}`);
  return data as NonNullable<T>;
}

async function main() {
  const owners = readOwnerDirectory(readFileSync(FILE, "utf8"));
  const company = await must("company", db.from("company").select("id").eq("subdomain", "simreipm").single());
  const cid = company.id;
  const properties = await must("properties", db.from("property").select("id, name, entity_id, entity(name), property_owner(owner_contact_id, contact(id, first_name, last_name))").eq("company_id", cid));
  const entities = await must("entities", db.from("entity").select("id, name").eq("company_id", cid));
  const log: string[] = [];

  for (const o of owners) {
    const emails = emailsOf(o.emails);
    const notes = [
      o.paymentType && `Paid by ${o.paymentType}${o.holdPayments ? " (payments on hold)" : ""}`,
      o.emailPackets ? `Owner packets by e-mail: ${o.packetReports ?? "yes"}` : "Owner packets not e-mailed",
      emails.length > 1 && `Other e-mails: ${emails.slice(1).join(", ")}`,
    ].filter(Boolean).join("\n");

    const owned = o.properties.map((p) => ({ ...p, property: properties.find((x) => sameProperty(p.name, x.name)) }));
    for (const p of owned.filter((x) => !x.property)) log.push(`  ! ${o.name}: no property called "${p.name}"`);

    if (o.kind === "business") {
      // An LLC or corporation that owns 100% of its properties: it is the owner on title.
      let entity = entities.find((e) => e.name.toLowerCase() === o.name.toLowerCase());
      const fields = { entity_type: o.entityType, email: emails[0] ?? null, phone: o.phone, mailing_address: o.mailingAddress, notes };
      log.push(`${entity ? "update" : "add"} owner ${o.name}: ${owned.filter((p) => p.property).map((p) => p.property!.name).join(", ")}`);
      if (commit) {
        if (entity) await must("update owner", db.from("entity").update(fields).eq("id", entity.id).select("id"));
        else entity = (await must("add owner", db.from("entity").insert({ company_id: cid, name: o.name, ...fields }).select("id, name")))[0];
        const ids = owned.filter((p) => p.property && p.pct === 100).map((p) => p.property!.id);
        if (ids.length) await must("move properties", db.from("property").update({ entity_id: entity!.id }).in("id", ids).select("id"));
      }
    } else {
      // A person with a share of a co-owned building: contact details on the partner record.
      for (const p of owned.filter((x) => x.property)) {
        const partner = p.property!.property_owner.find((po) => po.contact && po.contact.last_name?.toLowerCase() === o.last_name?.toLowerCase() && po.contact.first_name?.toLowerCase() === o.first_name?.toLowerCase());
        if (!partner) {
          log.push(`  ! ${o.name}: not listed as a partner of ${p.property!.name}`);
          continue;
        }
        log.push(`update partner ${o.name} (${p.pct}% of ${p.property!.name})`);
        if (commit) {
          await must(
            "update partner",
            db
              .from("contact")
              .update({ email: emails[0] ?? null, mobile: o.phone, notes: [o.mailingAddress && `Mailing address: ${o.mailingAddress}`, notes].filter(Boolean).join("\n") })
              .eq("id", partner.owner_contact_id)
              .select("id"),
          );
        }
      }
    }
  }

  // The placeholder owner the rent roll import used is removed once it owns nothing.
  if (commit) {
    const placeholder = entities.find((e) => e.name === UNASSIGNED);
    if (placeholder) {
      const left = await must("left", db.from("property").select("id").eq("entity_id", placeholder.id));
      if (!left.length) {
        await must("remove placeholder", db.from("entity").delete().eq("id", placeholder.id).select("id"));
        log.push(`removed the "${UNASSIGNED}" placeholder`);
      } else log.push(`  ! ${left.length} properties still have no owner`);
    }
  }
  console.log(log.join("\n"));
  console.log(commit ? "\nSaved." : "\nDry run: nothing saved. Add -- --commit to save.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
