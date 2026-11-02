// Reads exports from any property management software (Buildium, Rent Manager, Yardi, AppFolio, …) or a
// spreadsheet. The person picks what the file holds; columns are matched by name (and by AI when the
// company has a key), shown for checking, then turned into plain records. No database access here:
// lib/import/save.ts writes them. Runs in the browser too (the Import data screen previews with it).

import { address as splitAddress, guessTrade, parseCsv, personName, type Address, type VendorTrade } from "./appfolio";

export type ImportKind = "rent_roll" | "tenants" | "vendors" | "owners";
type FieldType = "text" | "money" | "date" | "number" | "yesno" | "bedsbaths";
export type ImportField = { key: string; label: string; type: FieldType; required?: boolean; hint?: string; names: string[] };

// `names` are the column headings different programs use, compared without case, spaces or punctuation.
const NAME = ["tenant", "tenant name", "resident", "resident name", "name", "full name", "lessee", "primary tenant", "tenants"];
const FIRST = ["first name", "tenant first name", "resident first name", "first"];
const LAST = ["last name", "tenant last name", "resident last name", "last", "surname"];
const EMAIL = ["email", "e-mail", "email address", "tenant email", "resident email", "emails", "primary email"];
const PHONE = ["phone", "phone number", "home phone", "phone numbers", "primary phone", "telephone", "office phone", "work phone", "tenant phone"];
const MOBILE = ["mobile", "cell", "cell phone", "mobile phone", "mobile number"];
const STREET = ["address", "street", "street address", "address 1", "address line 1", "mailing address", "property address", "property street address 1"];
const CITY = ["city", "property city", "mailing city"];
const STATE = ["state", "st", "property state", "mailing state"];
const ZIP = ["zip", "zip code", "postal code", "zipcode", "property zip", "mailing zip"];
const PROPERTY = ["property", "property name", "building", "building name", "property id", "community", "site"];
const UNIT = ["unit", "unit number", "unit name", "unit #", "apt", "apartment", "suite", "space", "unit id"];

export const IMPORT_KINDS: { kind: ImportKind; label: string; description: string; fields: ImportField[] }[] = [
  {
    kind: "rent_roll",
    label: "Rent roll",
    description: "Properties, units and current leases with each tenant's rent, deposit and balance. Import this first.",
    fields: [
      { key: "property", label: "Property", type: "text", required: true, hint: "Name or street address; rows with the same property are grouped.", names: PROPERTY },
      { key: "address", label: "Property street address", type: "text", names: STREET },
      { key: "city", label: "City", type: "text", names: CITY },
      { key: "state", label: "State", type: "text", names: STATE },
      { key: "zip", label: "ZIP", type: "text", names: ZIP },
      { key: "unit", label: "Unit", type: "text", hint: "Leave empty for single-family homes.", names: UNIT },
      { key: "unit_type", label: "Residential or commercial", type: "text", names: ["unit type", "property type", "type", "use", "unit use"] },
      { key: "beds", label: "Bedrooms", type: "number", names: ["beds", "bedrooms", "bed", "br", "bd"] },
      { key: "baths", label: "Bathrooms", type: "number", names: ["baths", "bathrooms", "bath", "ba"] },
      { key: "bedsbaths", label: "Beds/baths together (like 2/1)", type: "bedsbaths", names: ["bd/ba", "bed/bath", "beds/baths", "br/ba", "bedbath"] },
      { key: "sqft", label: "Square feet", type: "number", names: ["sqft", "sq ft", "square feet", "square footage", "size", "area"] },
      { key: "market_rent", label: "Market rent", type: "money", names: ["market rent", "marketing rent", "asking rent", "advertised rent"] },
      { key: "tenant", label: "Tenant name", type: "text", hint: "Empty means the unit is vacant.", names: NAME },
      { key: "tenant_first", label: "Tenant first name", type: "text", names: FIRST },
      { key: "tenant_last", label: "Tenant last name", type: "text", names: LAST },
      { key: "email", label: "Tenant e-mail", type: "text", names: EMAIL },
      { key: "phone", label: "Tenant phone", type: "text", names: PHONE },
      { key: "rent", label: "Monthly rent", type: "money", names: ["rent", "monthly rent", "current rent", "lease rent", "rent amount", "scheduled rent", "actual rent", "base rent"] },
      { key: "deposit", label: "Security deposit held", type: "money", names: ["deposit", "security deposit", "deposits held", "sec dep", "security deposit held", "deposit held", "deposits"] },
      { key: "balance", label: "Balance owed (credit as negative)", type: "money", hint: "Brought onto the ledger at cutover.", names: ["balance", "past due", "balance due", "amount due", "total due", "current balance", "outstanding balance", "open balance", "amount owed", "delinquent"] },
      { key: "lease_start", label: "Lease start", type: "date", names: ["lease from", "lease start", "lease start date", "start date", "lease begin", "from", "start"] },
      { key: "lease_end", label: "Lease end", type: "date", hint: "Empty means month-to-month.", names: ["lease to", "lease end", "lease end date", "end date", "lease expiration", "expiration", "lease expires", "to", "end"] },
      { key: "move_in", label: "Move-in date", type: "date", names: ["move in", "move-in", "move in date", "moved in"] },
      { key: "move_out", label: "Move-out date", type: "date", hint: "A date here means the tenant gave notice.", names: ["move out", "move-out", "move out date", "notice date", "vacate date"] },
      { key: "owner", label: "Owner (LLC or person)", type: "text", hint: "Matched to your owners by name; new names are added.", names: ["owner", "owner name", "owners", "landlord", "entity", "llc"] },
    ],
  },
  {
    kind: "tenants",
    label: "Tenant contacts",
    description: "Phones and e-mails for tenants already imported from the rent roll. Fills empty fields only.",
    fields: [
      { key: "tenant", label: "Tenant name", type: "text", names: NAME },
      { key: "tenant_first", label: "First name", type: "text", names: FIRST },
      { key: "tenant_last", label: "Last name", type: "text", names: LAST },
      { key: "email", label: "E-mail", type: "text", names: EMAIL },
      { key: "phone", label: "Phone", type: "text", names: PHONE },
      { key: "mobile", label: "Mobile", type: "text", names: MOBILE },
      { key: "property", label: "Property", type: "text", hint: "Helps tell apart two tenants with the same name.", names: PROPERTY },
      { key: "unit", label: "Unit", type: "text", names: UNIT },
    ],
  },
  {
    kind: "vendors",
    label: "Vendors",
    description: "Contractors and suppliers with their insurance and license dates. Vendors already on file are skipped.",
    fields: [
      { key: "name", label: "Company name", type: "text", hint: "Or map first and last name for a person.", names: ["company", "company name", "vendor", "vendor name", "business name", "name", "payee", "payee name"] },
      { key: "first", label: "First name", type: "text", names: FIRST },
      { key: "last", label: "Last name", type: "text", names: LAST },
      { key: "contact_person", label: "Contact person", type: "text", names: ["contact", "contact name", "contact person", "primary contact"] },
      { key: "email", label: "E-mail", type: "text", names: EMAIL },
      { key: "phone", label: "Phone", type: "text", names: PHONE },
      { key: "mobile", label: "Mobile", type: "text", names: MOBILE },
      { key: "address", label: "Street address", type: "text", names: STREET },
      { key: "city", label: "City", type: "text", names: CITY },
      { key: "state", label: "State", type: "text", names: STATE },
      { key: "zip", label: "ZIP", type: "text", names: ZIP },
      { key: "trade", label: "Trade", type: "text", hint: "Guessed from the name when empty.", names: ["trade", "category", "vendor type", "type", "service", "services", "specialty"] },
      { key: "is_1099", label: "Gets a 1099", type: "yesno", names: ["1099", "send 1099", "1099 vendor", "is 1099", "1099 eligible"] },
      { key: "coi_expires", label: "Liability insurance expires", type: "date", names: ["insurance expiration", "liability insurance expiration", "general liability expiration", "coi expiration", "insurance expires", "liability expires", "gl expiration"] },
      { key: "wc_expires", label: "Workers' comp expires", type: "date", names: ["workers comp expiration", "workers compensation expiration", "wc expiration", "workers comp expires"] },
      { key: "license_expires", label: "License expires", type: "date", names: ["license expiration", "license expires", "state license expiration"] },
      { key: "notes", label: "Notes", type: "text", names: ["notes", "note", "comments", "memo"] },
    ],
  },
  {
    kind: "owners",
    label: "Owners",
    description: "The LLCs and people who own the properties. Properties listed for an owner are put under them.",
    fields: [
      { key: "name", label: "Owner name", type: "text", required: true, names: ["owner", "owner name", "name", "company", "company name", "entity", "entity name", "llc"] },
      { key: "email", label: "E-mail", type: "text", names: EMAIL },
      { key: "phone", label: "Phone", type: "text", names: [...PHONE, ...MOBILE] },
      { key: "address", label: "Mailing address", type: "text", names: STREET },
      { key: "city", label: "City", type: "text", names: CITY },
      { key: "state", label: "State", type: "text", names: STATE },
      { key: "zip", label: "ZIP", type: "text", names: ZIP },
      { key: "tax_id", label: "Tax ID (only the last 4 digits are kept)", type: "text", names: ["tax id", "ein", "taxpayer id", "tin", "ssn/ein", "tax id number", "federal id"] },
      { key: "properties", label: "Properties owned", type: "text", hint: "Names separated by commas or semicolons.", names: ["properties", "properties owned", "property", "property names", "owned properties", "property name"] },
    ],
  },
];

export const kindInfo = (kind: ImportKind) => IMPORT_KINDS.find((k) => k.kind === kind)!;

// ---------- reading the file ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export type Sheet = { headers: string[]; rows: string[][]; headerRow: number };

/** Finds the heading row (exports often start with a title and date lines) and returns the rows under it. */
export function readSheet(text: string, kind: ImportKind): Sheet {
  const all = parseCsv(text.replace(/^﻿/, "")).filter((r) => r.some((c) => c.trim()));
  const known = new Set(kindInfo(kind).fields.flatMap((f) => f.names.map(norm)));
  let headerRow = all.findIndex((r, i) => i < 20 && r.filter((c) => known.has(norm(c))).length >= 2);
  if (headerRow < 0) headerRow = Math.max(0, all.findIndex((r) => r.filter((c) => c.trim()).length >= 2));
  const headers = (all[headerRow] ?? []).map((h, i) => clean(h) || `Column ${i + 1}`);
  return { headers, rows: all.slice(headerRow + 1), headerRow };
}

export type Mapping = Record<string, number | null>;

/** Matches file columns to fields by heading: exact names first, then partial ones. Each column is used once. */
export function guessMapping(kind: ImportKind, headers: string[]): Mapping {
  const fields = kindInfo(kind).fields;
  const used = new Set<number>();
  const map: Mapping = Object.fromEntries(fields.map((f) => [f.key, null]));
  const heads = headers.map(norm);
  for (const f of fields) {
    const i = heads.findIndex((h, j) => !used.has(j) && f.names.some((n) => norm(n) === h));
    if (i >= 0) {
      map[f.key] = i;
      used.add(i);
    }
  }
  for (const f of fields) {
    if (map[f.key] != null) continue;
    const i = heads.findIndex((h, j) => !used.has(j) && h.length > 2 && f.names.some((n) => norm(n).length > 3 && h.includes(norm(n))));
    if (i >= 0) {
      map[f.key] = i;
      used.add(i);
    }
  }
  return map;
}

/** Keeps only valid column numbers (an AI or a stale form could send anything). */
export function cleanMapping(kind: ImportKind, headers: string[], raw: Record<string, unknown>): Mapping {
  const out: Mapping = {};
  for (const f of kindInfo(kind).fields) {
    const v = raw[f.key];
    const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
    out[f.key] = Number.isInteger(n) && n >= 0 && n < headers.length ? n : null;
  }
  return out;
}

// ---------- values ----------
/** "$1,380.50" → 138050; "(10.50)" and "-$10.50" → -1050; "" → null */
export function money(value: string): number | null {
  let v = value.replace(/[$,\s]/g, "");
  const negative = /^\(.*\)$/.test(v) || v.startsWith("-");
  v = v.replace(/[()-]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) * (negative ? -1 : 1) : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** US dates in the shapes exports use: 5/1/2026, 05/01/26, 2026-05-01, May 1, 2026, 1-May-2026. */
export function usDate(value: string): string | null {
  const v = clean(value).replace(/\s+\d{1,2}:\d{2}.*$/, "");
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = v.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS.includes(m[1].toLowerCase())) return validDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  m = v.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{2}|\d{4})$/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  return null;
}

function num(value: string): number | null {
  const v = value.replace(/[,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;
}
const yes = (value: string) => /^(y|yes|true|1|x|✓)$/i.test(clean(value));
const BUSINESS = /\b(llc|inc|corp|co\.|company|ltd|lp|llp|pllc|group|services|church|trust|associates|enterprises|holdings|partners)\b/i;

// ---------- normalized records ----------
export type ImportIssue = { row: number; message: string };
export type ContactFields = { kind: "person" | "business"; business_name: string | null; first_name: string | null; last_name: string | null };

export type RentRollRow = {
  row: number;
  property: string;
  address: Address;
  unit: string;
  kind: "residential" | "commercial";
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  market_rent_cents: number | null;
  owner: string | null;
  tenant: (ContactFields & { email: string | null; phone: string | null }) | null;
  rent_cents: number;
  deposit_cents: number;
  balance_cents: number | null;
  start_date: string | null;
  end_date: string | null;
  move_in_on: string | null;
  move_out_on: string | null;
};
export type TenantRow = { row: number; name: { first_name: string | null; last_name: string | null; full: string }; email: string | null; phone: string | null; mobile: string | null; property: string | null; unit: string | null };
export type VendorRow = ContactFields & { row: number; contact_person: string | null; email: string | null; phone: string | null; mobile: string | null; address: Address; trade: VendorTrade; is_1099: boolean; coi_expires_on: string | null; workers_comp_expires_on: string | null; license_expires_on: string | null; notes: string | null };
export type OwnerRow = { row: number; name: string; entity_type: string | null; email: string | null; phone: string | null; mailing_address: string | null; tax_id_last4: string | null; properties: string[] };

export type Normalized =
  | { kind: "rent_roll"; records: RentRollRow[]; issues: ImportIssue[]; skipped: number }
  | { kind: "tenants"; records: TenantRow[]; issues: ImportIssue[]; skipped: number }
  | { kind: "vendors"; records: VendorRow[]; issues: ImportIssue[]; skipped: number }
  | { kind: "owners"; records: OwnerRow[]; issues: ImportIssue[]; skipped: number };

function contactFrom(full: string, first: string, last: string, forceBusiness = false): ContactFields | null {
  if (first || last) return { kind: "person", business_name: null, first_name: first || null, last_name: last || null };
  if (!full) return null;
  if (forceBusiness || BUSINESS.test(full)) return { kind: "business", business_name: full, first_name: null, last_name: null };
  return { kind: "person", business_name: null, ...personName(full) };
}

function addressFrom(street: string, city: string, state: string, zip: string): Address {
  if (street && !city && !state && !zip) return splitAddress(street); // one column holding the whole address
  return { address_line1: street || null, address_line2: null, city: city || null, state: state ? state.toUpperCase().slice(0, 2) : null, postal_code: zip || null };
}

const TRADES: VendorTrade[] = ["Plumbing", "Electrical", "HVAC", "Appliance repair", "Fire & life safety", "Elevator", "Pest control", "Landscaping", "Cleaning", "Flooring & tile", "General contractor", "Handyman", "Security systems", "Legal", "Bookkeeping", "Marketing & media", "Insurance financing", "Utility", "Supplies", "Government", "Other"];
function trade(value: string, name: string): VendorTrade {
  const exact = TRADES.find((t) => norm(t) === norm(value));
  if (exact) return exact;
  const fromValue = value ? guessTrade(value) : "Other";
  return fromValue !== "Other" ? fromValue : guessTrade(name);
}

/** Turns the file's rows into records using the mapping. `fillDown` repeats a property name onto the unit rows under it. */
export function normalize(kind: ImportKind, sheet: Sheet, map: Mapping): Normalized {
  const issues: ImportIssue[] = [];
  let skipped = 0;
  const fields = kindInfo(kind).fields;
  const rowNo = (i: number) => sheet.headerRow + i + 2; // the row number the person sees in Excel
  const cell = (r: string[], key: string) => (map[key] == null ? "" : clean(r[map[key]!]));
  const typed = (r: string[], i: number, key: string): string | number | null => {
    const raw = cell(r, key);
    if (!raw) return null;
    const f = fields.find((x) => x.key === key)!;
    const v = f.type === "money" ? money(raw) : f.type === "date" ? usDate(raw) : f.type === "number" ? num(raw) : raw;
    if (v == null) issues.push({ row: rowNo(i), message: `${f.label}: couldn't read "${raw}"` });
    return v;
  };
  const isTotal = (r: string[]) => r.some((c) => /^(grand )?totals?\b|^\d+ units?$/i.test(clean(c)));

  if (kind === "rent_roll") {
    const records: RentRollRow[] = [];
    let lastProperty = "";
    sheet.rows.forEach((r, i) => {
      if (isTotal(r)) return void skipped++;
      let property = cell(r, "property");
      const unit = cell(r, "unit");
      const tenantName = cell(r, "tenant");
      if (!property && (unit || tenantName)) property = lastProperty;
      if (!property) return void skipped++;
      if (!unit && !tenantName && !cell(r, "rent") && !cell(r, "address")) {
        lastProperty = property; // a group heading row
        return void skipped++;
      }
      lastProperty = property;
      const bb = cell(r, "bedsbaths").split("/");
      const tenant = contactFrom(tenantName, cell(r, "tenant_first"), cell(r, "tenant_last"));
      const vacantWord = /^(vacant|vacancy|unoccupied|model|down|admin)/i.test(tenantName);
      const typeWord = cell(r, "unit_type");
      const rec: RentRollRow = {
        row: rowNo(i),
        property,
        address: addressFrom(cell(r, "address"), cell(r, "city"), cell(r, "state"), cell(r, "zip")),
        unit: unit || "Home",
        kind: /commercial|retail|office|industrial|warehouse/i.test(typeWord) ? "commercial" : "residential",
        beds: (typed(r, i, "beds") as number | null) ?? num(bb[0] ?? ""),
        baths: (typed(r, i, "baths") as number | null) ?? num(bb[1] ?? ""),
        sqft: typed(r, i, "sqft") as number | null,
        market_rent_cents: typed(r, i, "market_rent") as number | null,
        owner: cell(r, "owner") || null,
        tenant: tenant && !vacantWord ? { ...tenant, email: cell(r, "email") || null, phone: cell(r, "phone") || null } : null,
        rent_cents: (typed(r, i, "rent") as number | null) ?? 0,
        deposit_cents: (typed(r, i, "deposit") as number | null) ?? 0,
        balance_cents: typed(r, i, "balance") as number | null,
        start_date: typed(r, i, "lease_start") as string | null,
        end_date: typed(r, i, "lease_end") as string | null,
        move_in_on: typed(r, i, "move_in") as string | null,
        move_out_on: typed(r, i, "move_out") as string | null,
      };
      if (rec.tenant && rec.rent_cents < 0) issues.push({ row: rec.row, message: "Rent is negative" });
      if (rec.tenant && !rec.start_date && !rec.move_in_on) issues.push({ row: rec.row, message: "No lease start or move-in date; the import uses the cutover date" });
      if (rec.deposit_cents < 0) issues.push({ row: rec.row, message: "Deposit is negative" });
      records.push(rec);
    });
    const seen = new Set<string>();
    for (const r of records) {
      const k = `${norm(r.property)}|${norm(r.unit)}`;
      if (seen.has(k)) issues.push({ row: r.row, message: `${r.property} ${r.unit} appears twice; only the first row is imported` });
      seen.add(k);
    }
    return { kind, records, issues, skipped };
  }

  if (kind === "tenants") {
    const records: TenantRow[] = [];
    sheet.rows.forEach((r, i) => {
      const full = cell(r, "tenant");
      const first = cell(r, "tenant_first");
      const last = cell(r, "tenant_last");
      if (isTotal(r) || (!full && !first && !last)) return void skipped++;
      const name = first || last ? { first_name: first || null, last_name: last || null, full: `${first} ${last}`.trim() } : { ...personName(full), full };
      records.push({ row: rowNo(i), name, email: cell(r, "email") || null, phone: cell(r, "phone") || null, mobile: cell(r, "mobile") || null, property: cell(r, "property") || null, unit: cell(r, "unit") || null });
    });
    return { kind, records, issues, skipped };
  }

  if (kind === "vendors") {
    const records: VendorRow[] = [];
    sheet.rows.forEach((r, i) => {
      const c = contactFrom(cell(r, "name"), cell(r, "first"), cell(r, "last"), Boolean(cell(r, "name")));
      if (isTotal(r) || !c) return void skipped++;
      const display = c.business_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`;
      records.push({
        row: rowNo(i),
        ...c,
        contact_person: cell(r, "contact_person") || null,
        email: cell(r, "email") || null,
        phone: cell(r, "phone") || null,
        mobile: cell(r, "mobile") || null,
        address: addressFrom(cell(r, "address"), cell(r, "city"), cell(r, "state"), cell(r, "zip")),
        trade: trade(cell(r, "trade"), display),
        is_1099: yes(cell(r, "is_1099")),
        coi_expires_on: typed(r, i, "coi_expires") as string | null,
        workers_comp_expires_on: typed(r, i, "wc_expires") as string | null,
        license_expires_on: typed(r, i, "license_expires") as string | null,
        notes: cell(r, "notes") || null,
      });
    });
    return { kind, records, issues, skipped };
  }

  const records: OwnerRow[] = [];
  sheet.rows.forEach((r, i) => {
    const name = cell(r, "name");
    if (isTotal(r) || !name) return void skipped++;
    const a = addressFrom(cell(r, "address"), cell(r, "city"), cell(r, "state"), cell(r, "zip"));
    const line = [a.address_line1, a.address_line2, a.city, [a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const digits = cell(r, "tax_id").replace(/\D/g, "");
    records.push({
      row: rowNo(i),
      name,
      entity_type: /\bllc\b/i.test(name) ? "LLC" : /\b(inc|corp)\b/i.test(name) ? "Corporation" : /\btrust\b/i.test(name) ? "Trust" : BUSINESS.test(name) ? null : "Individual",
      email: cell(r, "email") || null,
      phone: cell(r, "phone") || null,
      mailing_address: line || null,
      tax_id_last4: digits.length >= 4 ? digits.slice(-4) : null,
      properties: cell(r, "properties").split(/[;,|\n]/).map(clean).filter(Boolean),
    });
  });
  return { kind, records, issues, skipped };
}

/** Same building in two spellings: "12 Forest Ln" vs "12 forest lane". */
export function sameName(a: string, b: string): boolean {
  const short: Record<string, string> = { street: "st", avenue: "ave", lane: "ln", road: "rd", drive: "dr", boulevard: "blvd", court: "ct", circle: "cir", place: "pl", north: "n", south: "s", east: "e", west: "w" };
  const n = (s: string) => norm(s.toLowerCase().replace(/\b[a-z]+\b/g, (w) => short[w] ?? w));
  return Boolean(n(a)) && n(a) === n(b);
}

/** What a column holds, without its contents: for asking the AI to match columns without sending tenant data. */
export function columnShapes(sheet: Sheet): string[] {
  return sheet.headers.map((h, i) => {
    const vals = sheet.rows.slice(0, 30).map((r) => clean(r[i])).filter(Boolean);
    if (!vals.length) return `${h}: empty`;
    const share = (test: (v: string) => boolean) => vals.filter(test).length / vals.length;
    const shape = share((v) => usDate(v) != null) > 0.6 ? "dates" : share((v) => /^\(?-?\$?[\d,]+(\.\d+)?\)?$/.test(v)) > 0.6 ? (share((v) => v.includes("$") || v.includes(".")) > 0.3 ? "money" : "numbers") : share((v) => v.includes("@")) > 0.5 ? "e-mail addresses" : share((v) => /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(v)) > 0.5 ? "phone numbers" : share((v) => v.length <= 6) > 0.7 ? "short codes" : "text";
    return `${h}: ${shape}`;
  });
}
