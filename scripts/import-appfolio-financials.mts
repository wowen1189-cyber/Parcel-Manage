// Brings a company's bank accounts and starting book balances over from AppFolio at the switch.
// Run: npm run import:appfolio-financials                       (preview: changes nothing)
//      npm run import:appfolio-financials -- --commit           (adds the bank accounts: name, bank, last 4 only)
//      npm run import:appfolio-financials -- --commit --post-opening
//          (also posts one opening entry per owner entity, dated the export date. Money: run it only after
//           the owner has approved the preview, and the cash has been checked against the bank statements.)
//      add --company=<subdomain> for another company (default simreipm)
//
// Exports (git-ignored, in imports/financials/):
//   trial_balance_by_property-YYYYMMDD.csv  AppFolio Reports › Trial Balance by Property (property, gl_account, ending_balance; debits positive)
//   bank_accounts-YYYYMMDD.csv              name, bank, last4, entity, kind (operating | deposit_trust | corporate), copied from
//                                           AppFolio Accounting › Bank Accounts. Never full account or routing numbers.
//
// Opening entries carry the balance sheet only: cash (1000), security deposit trust cash (1010), security deposits
// held (2100) and prepaid rent (2200), one line per property, balanced by opening balance equity (3900). Year-to-date
// income and expenses stay in AppFolio's reports. Tenant balances are not here: they come over on each lease
// (sync:appfolio). Any other asset or liability account stops the posting and is listed for a person.

import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "../lib/import/appfolio.ts";
import type { Database } from "../lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase settings. Run with --env-file=.env.local.");
const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const commit = process.argv.includes("--commit");
const postOpening = process.argv.includes("--post-opening");
const subdomain = process.argv.find((a) => a.startsWith("--company="))?.split("=")[1] ?? "simreipm";
const DIR = "imports/financials";

function newest(prefix: string): { rows: Record<string, string>[]; date: string } {
  const f = readdirSync(DIR)
    .filter((n) => new RegExp(`^${prefix}-\\d{8}\\.csv$`).test(n))
    .sort()
    .at(-1);
  if (!f) throw new Error(`No ${prefix}-YYYYMMDD.csv in ${DIR}/`);
  const [head, ...rest] = parseCsv(readFileSync(`${DIR}/${f}`, "utf8").replace(/^﻿/, "")).filter((r) => r.some((c) => c.trim()));
  const d = f.match(/(\d{4})(\d{2})(\d{2})/)!;
  return { rows: rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()]))), date: `${d[1]}-${d[2]}-${d[3]}` };
}

const cents = (s: string) => (s && s !== "null" ? Math.round(Number(s.replace(/[$,]/g, "")) * 100) : 0);
const money = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** AppFolio account → Parcel Manage account, by its standard name; null for the income/expense/equity that rolls into 3900. */
function mapAccount(name: string): string | null | "unknown" {
  const n = name.toLowerCase();
  const num = Number(name.match(/^(\d+)/)?.[1] ?? 0);
  if (/security deposit cash|escrow cash|trust cash/.test(n)) return "1010";
  if (/operating cash|^\d+:\s*cash\b/.test(n)) return "1000";
  if (/security deposits?/.test(n) && num >= 2000 && num < 3000) return "2100";
  if (/prepaid rent|prepayment/.test(n)) return "2200";
  if (num >= 3000) return null;
  return "unknown";
}

const { data: company } = await db.from("company").select("id, name").eq("subdomain", subdomain).single();
if (!company) throw new Error(`No company ${subdomain}`);
const [{ data: entities }, { data: properties }, { data: existingBanks }, { data: openings }] = await Promise.all([
  db.from("entity").select("id, name").eq("company_id", company.id),
  db.from("property").select("id, name, entity_id").eq("company_id", company.id),
  db.from("bank_account").select("id, entity_id, gl_number, last4").eq("company_id", company.id),
  db.from("journal_entry").select("entity_id").eq("company_id", company.id).eq("source", "opening_balance").neq("status", "reversed"),
]);
const entityByName = new Map((entities ?? []).map((e) => [norm(e.name), e]));
const propertyByName = new Map((properties ?? []).map((p) => [norm(p.name), p]));
const problems: string[] = [];

// 1. Bank accounts.
const banks = newest("bank_accounts");
console.log(`\n${company.name}: bank accounts (AppFolio list of ${banks.date})`);
const toAdd: Database["public"]["Tables"]["bank_account"]["Insert"][] = [];
for (const b of banks.rows) {
  if (!/^\d{4}$/.test(b.last4)) throw new Error(`${b.name}: last4 must be exactly 4 digits (never a full account number).`);
  if (b.kind === "corporate") {
    console.log(`  skip  ${b.name} (${b.bank} …${b.last4}): the management company's own account, not an owner's`);
    continue;
  }
  const entity = entityByName.get(norm(b.entity));
  if (!entity) {
    problems.push(`Bank account ${b.name}: no owner entity named "${b.entity}"`);
    continue;
  }
  const gl = b.kind === "deposit_trust" ? "1010" : "1000";
  const have = (existingBanks ?? []).some((x) => x.entity_id === entity.id && x.gl_number === gl && x.last4 === b.last4);
  console.log(`  ${have ? "have" : "add "}  ${b.name.padEnd(28)} ${b.bank.padEnd(22)} …${b.last4}  ${gl === "1010" ? "deposit trust (1010)" : "operating (1000)    "}  ${entity.name}`);
  if (!have) toAdd.push({ company_id: company.id, entity_id: entity.id, name: b.name, institution: b.bank, last4: b.last4, gl_number: gl });
}

// 2. Opening balances, per entity and property.
const tb = newest("trial_balance_by_property");
type Line = { account: string; property_id: string; debit: number; credit: number; memo: string };
const byEntity = new Map<string, { lines: Line[]; cash: number; trust: number; held: number }>();
const byProperty = new Map<string, number>();
for (const r of tb.rows) {
  const amount = cents(r.ending_balance);
  byProperty.set(r.property, (byProperty.get(r.property) ?? 0) + amount);
  if (!amount) continue;
  const property = propertyByName.get(norm(r.property));
  if (!property) {
    problems.push(`Trial balance: no property named "${r.property}" (${r.gl_account} ${money(amount)})`);
    continue;
  }
  const account = mapAccount(r.gl_account);
  if (account === "unknown") {
    problems.push(`${r.property}: ${r.gl_account} ${money(amount)} has no matching Parcel Manage account`);
    continue;
  }
  const e = byEntity.get(property.entity_id) ?? { lines: [], cash: 0, trust: 0, held: 0 };
  byEntity.set(property.entity_id, e);
  const target = account ?? "3900";
  const memo = account ? `AppFolio ${r.gl_account}` : "AppFolio equity, income and expenses to date";
  const existing = e.lines.find((l) => l.account === target && l.property_id === property.id);
  const line = existing ?? { account: target, property_id: property.id, debit: 0, credit: 0, memo };
  if (!existing) e.lines.push(line);
  const net = line.debit - line.credit + amount;
  line.debit = Math.max(net, 0);
  line.credit = Math.max(-net, 0);
  if (target === "1000") e.cash += amount;
  if (target === "1010") e.trust += amount;
  if (target === "2100") e.held -= amount;
}
for (const [p, sum] of byProperty) if (Math.abs(sum) > 1) problems.push(`Trial balance for ${p} is off by ${money(sum)}`);

console.log(`\nOpening entries as of ${tb.date} (AppFolio trial balance by property; nothing is posted without --post-opening)`);
for (const [entityId, e] of byEntity) {
  const entity = (entities ?? []).find((x) => x.id === entityId)!;
  const name = (id: string) => (properties ?? []).find((p) => p.id === id)?.name ?? id;
  e.lines = e.lines.filter((l) => l.debit || l.credit).sort((a, b) => a.account.localeCompare(b.account) || name(a.property_id).localeCompare(name(b.property_id)));
  const dr = e.lines.reduce((s, l) => s + l.debit, 0);
  const cr = e.lines.reduce((s, l) => s + l.credit, 0);
  console.log(`\n  ${entity.name}${openings?.some((o) => o.entity_id === entityId) ? "  (already has an opening entry: will be skipped)" : ""}`);
  for (const l of e.lines) console.log(`    ${l.account}  ${name(l.property_id).padEnd(28)} ${l.debit ? money(l.debit).padStart(13) : "".padStart(13)} ${l.credit ? money(l.credit).padStart(13) : ""}`);
  console.log(`    Totals${"".padEnd(30)} ${money(dr).padStart(13)} ${money(cr).padStart(13)}`);
  console.log(`    Operating cash ${money(e.cash)} · deposit trust cash ${money(e.trust)} · deposits owed to tenants ${money(e.held)}`);
  // Fla. Stat. 83.49(1): the total of tenants' deposits must be held in a separate account (or covered by a surety bond).
  if (e.trust < e.held) problems.push(`${entity.name}: deposits owed to tenants (${money(e.held)}) are more than the deposit trust cash (${money(e.trust)}), short ${money(e.held - e.trust)}. Fla. Stat. 83.49(1). Check the escrow bank balance, or whether a surety bond covers it.`);
  if (dr !== cr) problems.push(`${entity.name}: opening entry does not balance (${money(dr)} vs ${money(cr)})`);
}

if (problems.length) {
  console.log(`\nNeeds a person (${problems.length}):`);
  for (const p of problems) console.log(`  - ${p}`);
}

if (!commit) {
  console.log(`\nPreview only. Add -- --commit to add the bank accounts${postOpening ? "" : "; --post-opening as well to post the entries (after approval)"}.`);
  process.exit(0);
}
if (toAdd.length) {
  const { error } = await db.from("bank_account").insert(toAdd);
  if (error) throw error;
}
console.log(`\nAdded ${toAdd.length} bank account(s).`);
if (!postOpening) process.exit(0);
const blocking = problems.filter((p) => !p.includes("83.49"));
if (blocking.length) throw new Error("Fix the items above before posting opening balances.");
for (const [entityId, e] of byEntity) {
  if (openings?.some((o) => o.entity_id === entityId)) continue;
  const { error } = await db.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: entityId,
    p_date: tb.date,
    p_memo: `Opening balances from AppFolio (trial balance by property, ${tb.date})`,
    p_source: "opening_balance",
    p_lines: e.lines.map((l) => ({ account: l.account, property_id: l.property_id, debit: l.debit, credit: l.credit, memo: l.memo })),
  });
  if (error) throw error;
}
console.log(`Posted opening entries for ${byEntity.size} entit${byEntity.size === 1 ? "y" : "ies"}.`);
