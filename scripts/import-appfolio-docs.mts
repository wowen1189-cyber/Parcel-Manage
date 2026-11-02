// Brings a company's AppFolio documents into Parcel Manage, each filed under its property or tenant's lease.
// Run: npm run import:appfolio-docs              (preview: says where each file will go, changes nothing)
//      npm run import:appfolio-docs -- --commit  (uploads; safe to run again, files already brought over are skipped)
//      add --company=<subdomain> for another company (default simreipm)
//
// Input (git-ignored, it holds tenant papers) in imports/appfolio-docs/:
//   files/<AppFolio file id>__<original name>   the downloaded files
//   pairs.txt        one "<file id>p<property id>" or "<file id>o<tenant id>" per line (whose page the file was on)
//   records.txt      "p<property id>~<property name>" per line
//   tenants.txt      "<tenant id>~<name>~<C|N|F|P status>~" separated by ";"
//   tenant-property.txt  "<property id>:<tenant id>.<tenant id>…" separated by spaces (current tenants)
// Past tenants' properties come from the AppFolio tenant directory exports in imports/.
// Every file is office only: AppFolio didn't say which were shared with tenants, so the portal never shows them.

import { readdirSync, readFileSync, statSync } from "node:fs";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "../lib/import/appfolio.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");
const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const commit = process.argv.includes("--commit");
const subdomain = process.argv.find((a) => a.startsWith("--company="))?.split("=")[1] ?? "simreipm";
const DIR = "imports/appfolio-docs";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\b(llc|inc|the)\b/g, "").replace(/[^a-z0-9]/g, "");
/** A name as its words in order, ignoring middle initials and "Last, First" order. */
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1).sort().join(" ");
const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", heic: "image/heic", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", txt: "text/plain", csv: "text/csv", mov: "video/quicktime", mp4: "video/mp4" };

/** A sensible document category from the file name. */
export function categoryFor(name: string): string {
  const n = name.toLowerCase();
  if (/\.(png|jpe?g|gif|heic|webp)$/.test(n) && !/(license|\bdl\b|\bid\b|passport|insurance|lease)/.test(n)) return "photo";
  if (/(insurance|policy|\bcoi\b|acord|declaration|renters)/.test(n)) return "insurance";
  if (/(ledger|statement|receipt)/.test(n)) return "statement";
  if (/(invoice|estimate|quote|proposal)/.test(n)) return "invoice";
  if (/(notice|3.day|7.day|15.day|30.day|demand|eviction)/.test(n)) return "notice";
  if (/(inspection|move.?in|move.?out|walk.?through|condition)/.test(n)) return "inspection";
  if (/(application|income|pay.?stub|bank stmt|\bdl\b|license|passport|\bssn\b|ein|sunbiz|id card)/.test(n)) return "application";
  if (/(lease|renewal|addend|agreement|amendment)/.test(n)) return "lease";
  return "other";
}

/** One upload over its own fresh connection (reused connections go stale after a few dozen uploads), up to 4 tries. */
async function uploadFile(path: string, bytes: Buffer, type: string): Promise<{ error: { message: string } | null }> {
  const target = new URL(`${url}/storage/v1/object/documents/${path.split("/").map(encodeURIComponent).join("/")}`);
  const once = () =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = https.request(
        target,
        { method: "POST", agent: false, timeout: 60_000, headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey!, "content-type": type, "content-length": bytes.length, "x-upsert": "true" } },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        },
      );
      req.on("timeout", () => req.destroy(new Error("timed out")));
      req.on("error", reject);
      req.end(bytes);
    });
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    try {
      const r = await once();
      if (r.status >= 200 && r.status < 300) return { error: null };
      last = (JSON.parse(r.body || "{}") as { message?: string }).message ?? `status ${r.status}`;
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      last = e instanceof Error ? e.message : "upload failed";
    }
  }
  return { error: { message: last } };
}

async function main() {
  const { data: company } = await db.from("company").select("id, name").eq("subdomain", subdomain).single();
  if (!company) throw new Error(`No company at ${subdomain}.`);
  const cid = company.id;

  const owner = new Map<string, { kind: "p" | "o"; id: string }>();
  for (const line of readFileSync(`${DIR}/pairs.txt`, "utf8").split("\n").filter(Boolean)) {
    const m = line.match(/^(\d+)([po])(\d+)$/);
    if (m) owner.set(m[1], { kind: m[2] as "p" | "o", id: m[3] });
  }
  const propName = new Map(readFileSync(`${DIR}/records.txt`, "utf8").split("\n").filter(Boolean).map((l) => [l.split("~")[0].slice(1), l.split("~")[1]] as const));
  const tenants = new Map(
    readFileSync(`${DIR}/tenants.txt`, "utf8")
      .split(";")
      .map((t) => t.trim().split("~"))
      .filter((t) => t[0])
      .map(([id, name, status]) => [id, { name: name.trim(), status }] as const),
  );
  const tenantProp = new Map<string, string>();
  for (const part of readFileSync(`${DIR}/tenant-property.txt`, "utf8").trim().split(/\s+/)) {
    const [pid, list] = part.split(":");
    for (const t of (list ?? "").split(".").filter(Boolean)) tenantProp.set(t, propName.get(pid) ?? "");
  }
  // Past and upcoming tenants: their property from the AppFolio tenant directory exports.
  const dirProp = new Map<string, string>();
  for (const f of readdirSync("imports").filter((n) => /^tenant_directory-\d{8}\.csv$/.test(n)).sort()) {
    const [head, ...rows] = parseCsv(readFileSync(`imports/${f}`, "utf8"));
    const ti = head.indexOf("Tenant"), pi = head.indexOf("Property");
    for (const r of rows) if (r[ti] && r[pi]) dirProp.set(nameKey(r[ti]), r[pi].split(" - ")[0].trim());
  }

  const [{ data: props }, { data: leases }, { data: existing }] = await Promise.all([
    db.from("property").select("id, name").eq("company_id", cid),
    db.from("lease").select("id, status, unit(property_id), lease_tenant(is_primary, role, contact(id, first_name, last_name, business_name))").eq("company_id", cid),
    db.from("document").select("storage_path").eq("company_id", cid).like("storage_path", `${cid}/appfolio/%`),
  ]);
  const propByName = new Map((props ?? []).map((p) => [p.name, p.id]));
  const have = new Set((existing ?? []).map((d) => d.storage_path));
  const rank: Record<string, number> = { active: 0, notice: 1, pending_signature: 2, draft: 3 };
  const findLease = (name: string) => {
    const n = norm(name);
    const hits = (leases ?? []).flatMap((l) =>
      l.lease_tenant
        .filter((t) => t.role === "tenant" && t.contact)
        .filter((t) => {
          const c = t.contact!;
          if (c.business_name && norm(c.business_name).length > 3 && (n.includes(norm(c.business_name)) || norm(c.business_name).includes(n))) return true;
          return Boolean(c.last_name && c.first_name && n.startsWith(norm(c.first_name)) && n.endsWith(norm(c.last_name)));
        })
        .map((t) => ({ lease: l, contact: t.contact! })),
    );
    const best = hits.sort((a, b) => (rank[a.lease.status] ?? 9) - (rank[b.lease.status] ?? 9))[0];
    // A business renting several units: file on its main lease, and say which AppFolio record it came from.
    return best ? { ...best, several: new Set(hits.map((h) => h.lease.id)).size > 1 } : null;
  };

  const counts = { property: 0, lease: 0, tenantPropertyOnly: 0, unlinked: 0, skipped: 0, uploaded: 0, failed: 0 };
  const unlinked: string[] = [];
  const files = readdirSync(`${DIR}/files`).filter((f) => /^\d+__/.test(f));
  for (const f of files) {
    const [afid, ...rest] = f.split("__");
    const original = rest.join("__");
    const o = owner.get(afid);
    // Some AppFolio names have no extension: tell the type from the file's first bytes.
    let ext = original.includes(".") ? original.split(".").pop()!.toLowerCase() : "";
    let stored = original;
    if (!TYPES[ext]) {
      const head = readFileSync(`${DIR}/files/${f}`).subarray(0, 8);
      const sniffed = head.subarray(0, 4).toString() === "%PDF" ? "pdf" : head[0] === 0x89 && head[1] === 0x50 ? "png" : head[0] === 0xff && head[1] === 0xd8 ? "jpg" : "";
      if (sniffed) {
        ext = sniffed;
        stored = `${original}.${sniffed}`;
      }
    }
    const path = `${cid}/appfolio/${afid}-${stored.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120)}`;
    if (have.has(path)) {
      counts.skipped++;
      continue;
    }
    let row: Database["public"]["Tables"]["document"]["Insert"] = { company_id: cid, storage_path: path, file_name: original.slice(0, 200), category: categoryFor(original), source: "appfolio", office_only: true };
    if (o?.kind === "p") {
      row.property_id = propByName.get(propName.get(o.id) ?? "") ?? null;
      counts.property++;
    } else if (o?.kind === "o") {
      const t = tenants.get(o.id);
      const hit = t ? findLease(t.name) : null;
      if (hit) {
        row = { ...row, lease_id: hit.lease.id, contact_id: hit.contact.id, property_id: hit.lease.unit.property_id, ...(hit.several ? { file_name: `${t!.name}: ${original}`.slice(0, 200) } : {}) };
        counts.lease++;
      } else {
        const pname = tenantProp.get(o.id) || (t ? dirProp.get(nameKey(t.name)) : undefined) || "";
        row.property_id = propByName.get(pname) ?? null;
        row.file_name = `${t?.name ?? "AppFolio tenant"}${t?.status === "P" ? " (past tenant)" : t?.status === "F" ? " (upcoming tenant)" : ""}: ${original}`.slice(0, 200);
        if (row.property_id) counts.tenantPropertyOnly++;
        else {
          counts.unlinked++;
          unlinked.push(row.file_name);
        }
      }
    } else {
      counts.unlinked++;
      unlinked.push(original);
    }
    if (!commit) continue;
    const bytes = readFileSync(`${DIR}/files/${f}`);
    // A direct request per file (a long-running client's connection goes stale after a few dozen uploads),
    // tried up to 4 times, waiting a little longer each time.
    const up = await uploadFile(path, bytes, TYPES[ext] ?? "application/octet-stream");
    if (up.error) {
      counts.failed++;
      console.error(`  upload failed: ${original}: ${up.error.message}`);
      continue;
    }
    const { error } = await db.from("document").insert(row);
    if (error) {
      counts.failed++;
      console.error(`  not saved: ${original}: ${error.message}`);
      continue;
    }
    counts.uploaded++;
    if (counts.uploaded % 10 === 0) console.log(`  …${counts.uploaded} uploaded`);
  }

  const size = files.reduce((s, f) => s + statSync(`${DIR}/files/${f}`).size, 0);
  console.log(`${company.name}: ${files.length} AppFolio files (${(size / 1048576).toFixed(0)} MB)${commit ? "" : " (preview, nothing changes)"}`);
  console.log(`  on a property: ${counts.property}`);
  console.log(`  on a tenant's lease: ${counts.lease}`);
  console.log(`  past or upcoming tenants, filed on their property: ${counts.tenantPropertyOnly}`);
  console.log(`  not linked to a property or lease: ${counts.unlinked}${unlinked.length ? `\n    ${unlinked.slice(0, 20).join("\n    ")}` : ""}`);
  if (counts.skipped) console.log(`  already brought over: ${counts.skipped}`);
  if (commit) console.log(`Uploaded ${counts.uploaded}${counts.failed ? `, ${counts.failed} failed` : ""}.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
