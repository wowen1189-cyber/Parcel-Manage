// Brings a company's bank accounts and starting book balances over from AppFolio at the switch.
// Run: npm run import:appfolio-financials                       (preview: changes nothing)
//      npm run import:appfolio-financials -- --commit           (adds the bank accounts: name, bank, last 4 only)
//      npm run import:appfolio-financials -- --commit --post-opening
//          (also posts one opening entry per owner, dated the export date. Money: run it only after the owner
//           has approved the preview.)
//      add --company=<subdomain> for another company (default simreipm)
//
// Exports (git-ignored, in imports/financials/):
//   trial_balance_by_property-YYYYMMDD.csv  AppFolio Reports › Trial Balance by Property (property, gl_account, ending_balance; debits positive)
//   bank_accounts-YYYYMMDD.csv              name, bank, last4, entity, kind (operating | deposit_trust | corporate), from
//                                           AppFolio Accounting › Bank Accounts. Never full account or routing numbers.
//                                           "corporate" is the management company's own account (Fee billing's books).
//   bank_balances-YYYYMMDD.csv (optional)   last4, balance: each account's bank statement balance on the switch date.
//                                           Not needed for an account with a bank feed (Bank accounts › Connect a
//                                           bank, then "Get today's balance"): its balance on the switch date is
//                                           worked back from the bank's current balance and the feed's transactions.
//
// Opening entries carry the balance sheet only (docs/02 "Owner money"):
//   - managed owners (we hold their money): cash, deposit trust cash, deposits held and prepaid rent per property
//     from AppFolio, which tie to the bank because AppFolio paid their distributions;
//   - own-books owners (money stays in the owner's bank): cash and trust cash from the bank statement balances,
//     because AppFolio never saw what the owner took out. Deposits held and prepaid rent still come from AppFolio.
//     The difference is opening balance equity (3900), i.e. the draws AppFolio never recorded;
//   - the management company: its account's bank balance.
// Year-to-date income and expenses stay in AppFolio's reports. Tenant balances come over on each lease
// (sync:appfolio). Any other asset or liability account stops the posting and is listed for a person.

import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { balanceAtEndOf } from "../lib/bank-feeds.ts";
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

function newest(prefix: string, required = true): { rows: Record<string, string>[]; date: string } | null {
  const f = readdirSync(DIR)
    .filter((n) => new RegExp(`^${prefix}-\\d{8}\\.csv$`).test(n))
    .sort()
    .at(-1);
  if (!f) {
    if (required) throw new Error(`No ${prefix}-YYYYMMDD.csv in ${DIR}/`);
    return null;
  }
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
  db.from("entity").select("id, name, books_mode, is_manager").eq("company_id", company.id),
  db.from("property").select("id, name, entity_id").eq("company_id", company.id),
  db.from("bank_account").select("id, entity_id, gl_number, last4, fc_balance_cents, fc_balance_as_of, bank_transaction(posted_on, amount_cents, fingerprint)").eq("company_id", company.id),
  db.from("journal_entry").select("entity_id").eq("company_id", company.id).eq("source", "opening_balance").neq("status", "reversed"),
]);
const entityByName = new Map((entities ?? []).map((e) => [norm(e.name), e]));
const propertyByName = new Map((properties ?? []).map((p) => [norm(p.name), p]));
const manager = (entities ?? []).find((e) => e.is_manager);
const problems: string[] = [];
const blocking: string[] = [];

// 1. Bank accounts.
const banks = newest("bank_accounts")!;
const balances = newest("bank_balances", false);
const balanceOf = new Map((balances?.rows ?? []).map((r) => [r.last4, cents(r.balance)]));
const switchDate = newest("trial_balance_by_property")!.date;
// Accounts with a bank feed: the balance at the end of the switch date, from the bank's current balance.
for (const b of existingBanks ?? []) {
  if (!b.last4 || balanceOf.has(b.last4) || b.fc_balance_cents == null || !b.fc_balance_as_of || b.fc_balance_as_of.slice(0, 10) < switchDate) continue;
  const fed = b.bank_transaction.filter((t) => t.fingerprint.startsWith("fc:"));
  balanceOf.set(b.last4, balanceAtEndOf(switchDate, Number(b.fc_balance_cents), fed.map((t) => ({ posted_on: t.posted_on, amount_cents: Number(t.amount_cents) }))));
}
console.log(`\n${company.name}: bank accounts (AppFolio list of ${banks.date})${balances ? `, bank balances of ${balances.date}` : ", no bank balances file yet"}`);
const toAdd: Database["public"]["Tables"]["bank_account"]["Insert"][] = [];
type Bank = { entityId: string; gl: string; last4: string; name: string };
const placed: Bank[] = [];
for (const b of banks.rows) {
  if (!/^\d{4}$/.test(b.last4)) throw new Error(`${b.name}: last4 must be exactly 4 digits (never a full account number).`);
  const entity = b.kind === "corporate" ? manager : entityByName.get(norm(b.entity));
  if (!entity) {
    blocking.push(b.kind === "corporate" ? `${b.name} (…${b.last4}) is the management company's account: set up its books first (Accounting › Fee billing).` : `Bank account ${b.name}: no owner named "${b.entity}"`);
    continue;
  }
  const gl = b.kind === "deposit_trust" ? "1010" : "1000";
  placed.push({ entityId: entity.id, gl, last4: b.last4, name: b.name });
  const have = (existingBanks ?? []).some((x) => x.entity_id === entity.id && x.gl_number === gl && x.last4 === b.last4);
  const bal = balanceOf.get(b.last4);
  console.log(`  ${have ? "have" : "add "}  ${b.name.padEnd(28)} ${b.bank.padEnd(22)} …${b.last4}  ${gl === "1010" ? "deposit trust" : "operating    "}  ${entity.name.padEnd(34)} ${bal == null ? "" : `bank ${money(bal)}`}`);
  if (!have) toAdd.push({ company_id: company.id, entity_id: entity.id, name: b.name, institution: b.bank, last4: b.last4, gl_number: gl });
}
const bankTotal = (entityId: string, gl: string) => {
  const accts = placed.filter((b) => b.entityId === entityId && b.gl === gl);
  if (!accts.length) return 0;
  if (accts.some((a) => !balanceOf.has(a.last4))) return null;
  return accts.reduce((s, a) => s + balanceOf.get(a.last4)!, 0);
};

// 2. Opening balances.
const tb = newest("trial_balance_by_property")!;
type Line = { account: string; property_id: string | null; debit: number; credit: number; memo: string };
type Book = { lines: Line[]; cash: number; trust: number; held: number };
const byEntity = new Map<string, Book>();
const byProperty = new Map<string, number>();
const book = (id: string) => byEntity.get(id) ?? byEntity.set(id, { lines: [], cash: 0, trust: 0, held: 0 }).get(id)!;
const post = (b: Book, account: string, property_id: string | null, amount: number, memo: string) => {
  const existing = b.lines.find((l) => l.account === account && l.property_id === property_id);
  const line = existing ?? { account, property_id, debit: 0, credit: 0, memo };
  if (!existing) b.lines.push(line);
  const net = line.debit - line.credit + amount;
  line.debit = Math.max(net, 0);
  line.credit = Math.max(-net, 0);
};
for (const r of tb.rows) {
  const amount = cents(r.ending_balance);
  byProperty.set(r.property, (byProperty.get(r.property) ?? 0) + amount);
  if (!amount) continue;
  const property = propertyByName.get(norm(r.property));
  if (!property) {
    blocking.push(`Trial balance: no property named "${r.property}" (${r.gl_account} ${money(amount)})`);
    continue;
  }
  const account = mapAccount(r.gl_account);
  if (account === "unknown") {
    blocking.push(`${r.property}: ${r.gl_account} ${money(amount)} has no matching Parcel Manage account`);
    continue;
  }
  const b = book(property.entity_id);
  post(b, account ?? "3900", property.id, amount, account ? `AppFolio ${r.gl_account}` : "AppFolio equity, income and expenses to date");
  if (account === "1000") b.cash += amount;
  if (account === "1010") b.trust += amount;
  if (account === "2100") b.held -= amount;
}
for (const [p, sum] of byProperty) if (Math.abs(sum) > 1) blocking.push(`Trial balance for ${p} is off by ${money(sum)}`);

// Own-books owners and the management company: cash from the bank, not AppFolio.
for (const e of entities ?? []) {
  if (e.books_mode !== "own_books" || e.is_manager) continue;
  const b = book(e.id);
  for (const gl of ["1000", "1010"]) {
    const bank = bankTotal(e.id, gl);
    if (bank == null) {
      blocking.push(`${e.name}: needs the bank statement balance of its ${gl === "1000" ? "operating" : "escrow"} account (bank_balances file), because its money stays in its own bank.`);
      continue;
    }
    // Move AppFolio's per-property cash into one owner-level line at the bank's figure; the difference goes to 3900.
    const appfolio = b.lines.filter((l) => l.account === gl).reduce((s, l) => s + l.debit - l.credit, 0);
    b.lines = b.lines.filter((l) => l.account !== gl);
    if (bank) post(b, gl, null, bank, `Bank statement balance, ${balances!.date}`);
    if (bank - appfolio) post(b, "3900", null, -(bank - appfolio), `Difference from AppFolio's ${gl === "1000" ? "cash" : "trust cash"} (${money(appfolio)}): draws and transfers AppFolio didn't record`);
    if (gl === "1000") b.cash = bank;
    else b.trust = bank;
  }
}
// Managed owners: AppFolio's cash should already match the bank.
for (const e of entities ?? []) {
  if (e.books_mode !== "managed" || e.is_manager || !byEntity.has(e.id)) continue;
  const b = byEntity.get(e.id)!;
  for (const [gl, book] of [["1000", b.cash], ["1010", b.trust]] as const) {
    const bank = bankTotal(e.id, gl);
    if (bank != null && bank !== book) blocking.push(`${e.name}: AppFolio's ${gl === "1000" ? "operating" : "escrow"} cash is ${money(book)} but the bank says ${money(bank)}. A managed owner must tie: find the difference first.`);
  }
}

console.log(`\nOpening entries as of ${tb.date} (nothing is posted without --post-opening)`);
const nameOf = (id: string | null) => (id ? ((properties ?? []).find((p) => p.id === id)?.name ?? id) : "(whole owner)");
for (const [entityId, b] of byEntity) {
  const e = (entities ?? []).find((x) => x.id === entityId)!;
  b.lines = b.lines.filter((l) => l.debit || l.credit).sort((x, y) => x.account.localeCompare(y.account) || nameOf(x.property_id).localeCompare(nameOf(y.property_id)));
  const dr = b.lines.reduce((s, l) => s + l.debit, 0);
  const cr = b.lines.reduce((s, l) => s + l.credit, 0);
  const mode = e.is_manager ? "management company" : e.books_mode === "own_books" ? "own books" : "managed";
  console.log(`\n  ${e.name} (${mode})${openings?.some((o) => o.entity_id === entityId) ? "  (already has an opening entry: will be skipped)" : ""}`);
  for (const l of b.lines) console.log(`    ${l.account}  ${nameOf(l.property_id).padEnd(28)} ${l.debit ? money(l.debit).padStart(13) : "".padStart(13)} ${l.credit ? money(l.credit).padStart(13) : "".padStart(13)}  ${l.memo.startsWith("AppFolio") ? "" : l.memo}`);
  console.log(`    Totals${"".padEnd(30)} ${money(dr).padStart(13)} ${money(cr).padStart(13)}`);
  if (!e.is_manager) console.log(`    Operating cash ${money(b.cash)} · deposit trust cash ${money(b.trust)} · deposits owed to tenants ${money(b.held)}`);
  // Fla. Stat. 83.49(1): the total of tenants' deposits must be held in a separate account (or covered by a surety bond).
  if (b.trust < b.held) problems.push(`${e.name}: deposits owed to tenants (${money(b.held)}) are more than the deposit trust cash (${money(b.trust)}), short ${money(b.held - b.trust)}. Fla. Stat. 83.49(1). Check the escrow bank balance, or whether a surety bond covers it.`);
  if (dr !== cr) blocking.push(`${e.name}: opening entry does not balance (${money(dr)} vs ${money(cr)})`);
}
// The management company's account has no AppFolio trial balance: just its bank balance.
if (manager && !byEntity.has(manager.id)) {
  const bank = bankTotal(manager.id, "1000");
  if (bank == null) blocking.push(`${manager.name}: needs its account's bank statement balance (bank_balances file).`);
  else if (bank) {
    byEntity.set(manager.id, { lines: [{ account: "1000", property_id: null, debit: bank, credit: 0, memo: "Bank statement balance" }, { account: "3900", property_id: null, debit: 0, credit: bank, memo: "Opening balance" }], cash: bank, trust: 0, held: 0 });
    console.log(`\n  ${manager.name} (management company)\n    1000  operating cash ${money(bank)} / 3900 opening balance equity`);
  }
}

if (problems.length || blocking.length) {
  console.log(`\nNeeds a person (${problems.length + blocking.length}):`);
  for (const p of [...blocking, ...problems]) console.log(`  - ${p}`);
}

if (!commit) {
  console.log(`\nPreview only. Add -- --commit to add the bank accounts; --post-opening as well to post the entries (after approval).`);
  process.exit(0);
}
if (toAdd.length) {
  const { error } = await db.from("bank_account").insert(toAdd);
  if (error) throw error;
}
console.log(`\nAdded ${toAdd.length} bank account(s).`);
if (!postOpening) process.exit(0);
if (blocking.length) throw new Error("Fix the items above before posting opening balances.");
for (const [entityId, b] of byEntity) {
  if (openings?.some((o) => o.entity_id === entityId)) continue;
  const { error } = await db.rpc("post_journal_entry", {
    p_company: company.id,
    p_entity: entityId,
    p_date: tb.date,
    p_memo: `Opening balances from AppFolio (trial balance by property${balances ? ` and bank balances of ${balances.date}` : ""}, ${tb.date})`,
    p_source: "opening_balance",
    p_lines: b.lines.map((l) => ({ account: l.account, property_id: l.property_id ?? "", debit: l.debit, credit: l.credit, memo: l.memo })),
  });
  if (error) throw error;
}
console.log(`Posted opening entries for ${byEntity.size} owner(s).`);
